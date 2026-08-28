// Derives sign, nakshatra, star lord, sub lord, and sub-sub lord directly
// from an exact sidereal longitude — the piece needed to auto-generate a full
// chart instead of typing these fields in by hand.

const KP_SUBLORD_LOGIC_TEXT = [
  ['KP Sub Lord Derivation — Logic and Sequence'],
  [''],
  ['1. Sign: the 30° zodiac sign containing the longitude.'],
  ['2. Nakshatra + Star Lord: the 13°20\' nakshatra containing the longitude, and its fixed ruling planet (see kpTables.js).'],
  ['3. Sub Lord: each nakshatra is further divided into 9 unequal parts, in the same 9-planet Vimshottari cycle, STARTING from that nakshatra\'s own star lord, with each part\'s width proportional to that planet\'s Vimshottari years (out of 120) — the same proportions used for dasha timing. The part containing the longitude gives the sub lord.'],
  ['4. Sub-Sub Lord: the sub lord\'s own span is divided again the same way (9 parts, proportional to Vimshottari years, starting from the sub lord itself) — the part containing the longitude gives the sub-sub lord.'],
  [''],
  ['This is the standard KP 4-level (sign/star/sub/sub-sub) breakdown, computed automatically instead of requiring it typed in by hand — useful once exact longitude is available from the ephemeris.']
];

// Splits [startDeg, endDeg) into 9 unequal parts, in Vimshottari-cycle order
// starting from startLord, sized proportionally to each lord's dasha years.
function subdivideByVimshottari(startDeg, endDeg, startLord) {
  const totalSpan = endDeg - startDeg;
  const order = sequenceStartingFrom(startLord);
  let cursor = startDeg;
  return order.map(lord => {
    const span = totalSpan * (VIMSHOTTARI_YEARS[lord] / VIMSHOTTARI_TOTAL_YEARS);
    const segment = { lord, startDeg: cursor, endDeg: cursor + span };
    cursor += span;
    return segment;
  });
}

function segmentContaining(segments, longitude) {
  return segments.find(s => longitude >= s.startDeg && longitude < s.endDeg) || segments[segments.length - 1];
}

// Returns { sign, nakshatra, starLord, subLord, subSubLord } for a sidereal longitude.
function deriveKpLords(longitude) {
  const lon = normalizeDegrees(longitude);
  const sign = SIGNS[Math.floor(lon / 30)];
  const nak = nakshatraFromLongitude(lon);

  const subSegments = subdivideByVimshottari(nak.startDeg, nak.endDeg, nak.starLord);
  const subSegment = segmentContaining(subSegments, lon);

  const subSubSegments = subdivideByVimshottari(subSegment.startDeg, subSegment.endDeg, subSegment.lord);
  const subSubSegment = segmentContaining(subSubSegments, lon);

  return {
    sign,
    nakshatra: nak.name,
    starLord: nak.starLord,
    subLord: subSegment.lord,
    subSubLord: subSubSegment.lord
  };
}

if (typeof module !== 'undefined') {
  module.exports = { KP_SUBLORD_LOGIC_TEXT, deriveKpLords, subdivideByVimshottari };
}
