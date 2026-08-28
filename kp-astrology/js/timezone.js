// Converts a birth LOCAL date/time to UTC, needed before any ephemeris call
// (which all take a UTC instant). Two supported modes, both fully offline:
//   - IANA time zone name (e.g. "Asia/Kolkata") — uses the browser's built-in
//     IANA time zone database via Intl, which ships with every modern
//     browser and needs no network access or bundled data.
//   - A direct numeric UTC offset (e.g. "+5:30") — no DST ambiguity, always
//     unambiguous, useful for historical dates or when you already know the
//     exact offset that applied.

const TIMEZONE_LOGIC_TEXT = [
  ['Timezone Conversion — Logic and Sequence'],
  [''],
  ['1. All ephemeris calculations (planet longitude, sidereal time, sunrise) need the birth instant in UTC. Birth records are usually written in local clock time, so that local time must be converted first.'],
  ['2. IANA zone mode: the browser\'s built-in time zone database (the same one used by every modern OS and browser, requiring no internet access) is asked what UTC instant corresponds to the given zone name and wall-clock date/time, correctly accounting for the historical Daylight Saving Time rules in effect on that date.'],
  ['3. UTC offset mode: the given local time is shifted by the stated fixed offset (e.g. India Standard Time is always UTC+5:30) — no DST lookup, so it is unambiguous but requires you to already know the correct historical offset.'],
  [''],
  ['Caveat: IANA zone mode relies on the offset conversion converging in two iterations, which is correct for the vast majority of date/times but can be ambiguous in the one-hour window each year when clocks "fall back" for DST — for a birth in that exact window, use UTC offset mode with the offset you know applied.']
];

// Returns the UTC offset (in minutes) that `timeZone` had at the instant `date`.
function getTimezoneOffsetMinutes(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = formatter.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (asIfUtc - date.getTime()) / 60000;
}

// year/month/day/hour/minute are the LOCAL wall-clock birth values (month 1-12).
function zonedLocalToUtc(year, month, day, hour, minute, timeZone) {
  let guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 2; i++) {
    const offsetMinutes = getTimezoneOffsetMinutes(new Date(guessUtcMs), timeZone);
    guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60000;
  }
  return new Date(guessUtcMs);
}

// offsetStr like "+5:30", "-05:00", "5.5", "-4".
function parseUtcOffsetToMinutes(offsetStr) {
  const trimmed = String(offsetStr).trim();
  const colonMatch = trimmed.match(/^([+-]?)(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const sign = colonMatch[1] === '-' ? -1 : 1;
    return sign * (parseInt(colonMatch[2], 10) * 60 + parseInt(colonMatch[3], 10));
  }
  const decimal = parseFloat(trimmed);
  if (!isNaN(decimal)) return Math.round(decimal * 60);
  throw new Error('Could not parse UTC offset: ' + offsetStr);
}

function offsetLocalToUtc(year, month, day, hour, minute, offsetMinutes) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60000);
}

if (typeof module !== 'undefined') {
  module.exports = {
    TIMEZONE_LOGIC_TEXT, getTimezoneOffsetMinutes, zonedLocalToUtc,
    parseUtcOffsetToMinutes, offsetLocalToUtc
  };
}
