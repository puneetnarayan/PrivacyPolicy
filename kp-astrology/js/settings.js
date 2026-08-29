// App settings: the astronomical choices that affect every calculation in
// this app, made explicit and persisted instead of buried as hardcoded
// constants. Persisted to localStorage so they survive a page reload.
//
// IMPORTANT: only options actually implemented elsewhere in the app are
// selectable here. Adding a new ayanamsa or house system means implementing
// its formula in ephemeris.js / placidusCusps.js first, then adding it to
// the AVAILABLE_* lists below — this file never invents behavior other
// modules don't have.

const SETTINGS_LOGIC_TEXT = [
  ['Settings — Logic and Sequence'],
  [''],
  ['1. Every chart calculation in this app depends on four choices: Ayanamsa (sidereal offset), House System, Node Method (Rahu/Ketu), and the birth Timezone mode — all previously hardcoded in code, now explicit and shown here.'],
  ['2. Settings persist locally (in this browser) between sessions, so they don\'t need re-selecting every time.'],
  ['3. Only options with a real, implemented formula are selectable — this app will not offer a setting it can\'t actually compute.'],
  [''],
  ['Currently implemented: Lahiri ayanamsa, Placidus houses, Mean Node for Rahu/Ketu — computed by real Swiss Ephemeris (js/swissephBridge.js) once it loads, or by this app\'s own astronomy-engine-based fallback otherwise (see the engine status line at the top of the page). Additional ayanamsas/house systems require wiring them into the bridge/fallback first — this is a placeholder for that future expansion (Swiss Ephemeris itself already supports several, including a Krishnamurti ayanamsa, not yet exposed as a setting here), not a claim those options work today.']
];

const SETTINGS_STORAGE_KEY = 'kpAstrologyAppSettings';

const AVAILABLE_AYANAMSAS = [
  { id: 'lahiri', label: 'Lahiri (Chitrapaksha) — implemented', implemented: true }
];
const AVAILABLE_HOUSE_SYSTEMS = [
  { id: 'placidus', label: 'Placidus — implemented', implemented: true }
];
const AVAILABLE_NODE_METHODS = [
  { id: 'mean', label: 'Mean Node (KP standard) — implemented', implemented: true },
  { id: 'true', label: 'True Node — not currently implemented', implemented: false }
];

const DEFAULT_SETTINGS = {
  ayanamsa: 'lahiri',
  houseSystem: 'placidus',
  nodeMethod: 'mean'
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) — settings just won't persist this run.
  }
}

// One-line human-readable summary, meant to be shown alongside any chart's
// results so it's always clear which settings produced it.
function describeSettings(settings) {
  const ayanamsa = AVAILABLE_AYANAMSAS.find(a => a.id === settings.ayanamsa);
  const houseSystem = AVAILABLE_HOUSE_SYSTEMS.find(h => h.id === settings.houseSystem);
  const nodeMethod = AVAILABLE_NODE_METHODS.find(n => n.id === settings.nodeMethod);
  return `Ayanamsa: ${ayanamsa ? ayanamsa.label.split(' — ')[0] : settings.ayanamsa} · `
    + `Houses: ${houseSystem ? houseSystem.label.split(' — ')[0] : settings.houseSystem} · `
    + `Node: ${nodeMethod ? nodeMethod.label.split(' — ')[0] : settings.nodeMethod}`;
}

if (typeof module !== 'undefined') {
  module.exports = {
    SETTINGS_LOGIC_TEXT, SETTINGS_STORAGE_KEY,
    AVAILABLE_AYANAMSAS, AVAILABLE_HOUSE_SYSTEMS, AVAILABLE_NODE_METHODS, DEFAULT_SETTINGS,
    loadSettings, saveSettings, describeSettings
  };
}
