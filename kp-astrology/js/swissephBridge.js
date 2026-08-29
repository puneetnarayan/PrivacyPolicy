// Loads the real Swiss Ephemeris (compiled to WebAssembly) and, once ready,
// becomes the app's calculation engine — this is the "prefer Swiss Ephemeris,
// don't approximate merely for convenience" requirement.
//
// Bridging approach: this file is an ES module (Swiss Ephemeris's JS wrapper
// requires ESM + async init), but the rest of the app is plain synchronous
// <script> files loaded in order. Rather than convert the whole app to
// modules, this bridge initializes Swiss Ephemeris as early as possible and
// exposes plain synchronous global functions once ready. ephemeris.js and
// placidusCusps.js check `window.SWISSEPH_READY` at call time: true → use
// Swiss Ephemeris; false (still loading, or the WASM failed to load at all)
// → fall back to the existing astronomy-engine implementation, unchanged.
// This is the same "gracefully fall back to the local engine" behavior the
// architecture calls for, just applied one level deeper (WASM engine ->
// analytic JS engine, both fully offline) rather than online -> offline.
//
// Licensing note: Swiss Ephemeris is AGPL-3.0-or-later (this WASM build via
// the "swisseph-wasm" npm package, itself GPL-3.0-or-later). For personal,
// single-user, non-distributed use this carries no copyleft obligations —
// AGPL's network-use clause and GPL's distribution clause both hinge on
// distributing the software or offering it as a network service to others,
// neither of which applies here. Revisit this note before ever distributing
// this app to anyone else or hosting it as a shared service.

import SwissEph from '../ephemeris/src/swisseph.js';

window.SWISSEPH_READY = false;
window.SWISSEPH_LOAD_ERROR = null;

const swe = new SwissEph();

window.SWISSEPH_INIT_PROMISE = swe.initSwissEph()
  .then(() => {
    swe.set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);
    window.SWISSEPH_READY = true;

    // --- Plain synchronous globals, matching what ephemeris.js / placidusCusps.js need ---

    const SWE_BODY_ID = {
      Sun: swe.SE_SUN, Moon: swe.SE_MOON, Mars: swe.SE_MARS, Mercury: swe.SE_MERCURY,
      Jupiter: swe.SE_JUPITER, Venus: swe.SE_VENUS, Saturn: swe.SE_SATURN
    };

    // Sidereal longitude (Lahiri) for one body, for the given UTC Date.
    window.sweSingleLongitude = function (bodyName, date) {
      const jd = dateToJulianDayUtc(date);
      if (bodyName === 'Rahu') {
        return normalize360(swe.calc_ut(jd, swe.SE_MEAN_NODE, swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL)[0]);
      }
      if (bodyName === 'Ketu') {
        return normalize360(swe.calc_ut(jd, swe.SE_MEAN_NODE, swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL)[0] + 180);
      }
      return normalize360(swe.calc_ut(jd, SWE_BODY_ID[bodyName], swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL)[0]);
    };

    // Sidereal longitudes for all 9 KP planets at once.
    window.swePlanetLongitudes = function (date) {
      const result = {};
      Object.keys(SWE_BODY_ID).forEach(name => { result[name] = window.sweSingleLongitude(name, date); });
      result.Rahu = window.sweSingleLongitude('Rahu', date);
      result.Ketu = window.sweSingleLongitude('Ketu', date);
      return result;
    };

    // Sidereal Placidus house cusps { 1: deg, ..., 12: deg } for a UTC Date + place.
    window.swePlacidusCuspsSidereal = function (date, latitude, longitude) {
      const jd = dateToJulianDayUtc(date);
      const ayanamsa = swe.get_ayanamsa(jd);
      const houses = swe.houses(jd, latitude, longitude, 'P'); // tropical cusps
      const cusps = {};
      for (let h = 1; h <= 12; h++) cusps[h] = normalize360(houses.cusps[h] - ayanamsa);
      return cusps;
    };

    // Sidereal Ascendant only (still uses the same swe.houses() call — at
    // ~17 microseconds per call it's cheap enough for stepping searches too).
    window.sweAscendantSidereal = function (date, latitude, longitude) {
      const jd = dateToJulianDayUtc(date);
      const ayanamsa = swe.get_ayanamsa(jd);
      const houses = swe.houses(jd, latitude, longitude, 'P');
      return normalize360(houses.ascmc[0] - ayanamsa);
    };

    document.dispatchEvent(new CustomEvent('swisseph-ready'));
  })
  .catch(err => {
    window.SWISSEPH_LOAD_ERROR = err;
    window.SWISSEPH_READY = false;
    document.dispatchEvent(new CustomEvent('swisseph-load-failed', { detail: err }));
  });

function dateToJulianDayUtc(date) {
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return swe.julday(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour);
}

function normalize360(deg) {
  return ((deg % 360) + 360) % 360;
}
