// Background update checker: weekly cadence, short timeout, silent when
// there's nothing to report, and never blocks or delays app startup.
//
// This implements the CLIENT side only — checking a manifest URL, comparing
// versions, and showing the popup. It does not download/apply updates or
// verify signatures, since that depends on how the app is packaged (see
// Electron scaffold) and where the manifest/downloads are actually hosted,
// neither of which exists yet. Point MANIFEST_URL at your real hosting once
// you have it; until then this safely no-ops (same as "no internet").

const UPDATER_LOGIC_TEXT = [
  ['Update Checker — Logic and Sequence'],
  [''],
  ['1. On startup, check how long it has been since the last successful update check (stored locally). If less than 7 days, do nothing — no network request is made at all.'],
  ['2. If 7+ days have passed (or no check has ever succeeded), fetch the version manifest with a short timeout (4 seconds) in the background. Startup never waits for this.'],
  ['3. If the fetch fails, times out, or returns invalid JSON: fail silently. No error is shown to the user, nothing blocks, the app continues normally. The last-check timestamp is only updated on a SUCCESSFUL fetch, so a failed attempt will be retried next launch rather than waiting another 7 days.'],
  ['4. If the fetch succeeds, compare the manifest\'s "version" against the app\'s installed version using proper semantic versioning (major.minor.patch numeric comparison, not string comparison — so "1.5.0" is correctly seen as newer than "1.4.9", and "1.5.0" is correctly NOT newer than "1.5.10").'],
  ['5. If the manifest version is newer: show a small popup with the current/new version and release notes, auto-closing after ~10 seconds. "Update Now" downloads the update file with a live progress bar; "Later" (or the timeout) simply dismisses it. Neither blocks the app.'],
  ['6. If the manifest version is the same or older: do nothing. No popup, ever, when there\'s no update — this applies to the silent weekly background check.'],
  ['7. A manually-triggered check (the Settings tab\'s "Check for Updates Now" button) behaves differently on failure: since the user explicitly asked, a small "No internet connection" popup is shown, auto-closing after 10 seconds or immediately on "Cancel" — whichever happens first.'],
  [''],
  ['Caveat: "Update Now" downloads the file at the manifest\'s downloadUrl with a progress bar, then hands it to you as a normal browser-saved file to run — it does not verify a SHA-256/signature or atomically replace the running app\'s files, since that needs real hosting/signing infrastructure this app isn\'t pointed at yet (see ARCHITECTURE_STATUS.md).']
];

const UPDATER_STORAGE_KEY = 'kpAstrologyLastUpdateCheck';
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_TIMEOUT_MS = 4000;

const INSTALLED_VERSION = '1.0.0';
// Placeholder — point this at your real hosting once available (a raw file
// URL, your own server, a shared/synced folder served over http(s), etc.).
// Until then, fetches to this will simply fail and the checker no-ops.
const MANIFEST_URL = 'update-manifest.json';

// Returns -1, 0, or 1 — proper numeric semver comparison, not string comparison.
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

function getLastCheckTime() {
  try {
    const raw = localStorage.getItem(UPDATER_STORAGE_KEY);
    return raw ? Number(raw) : 0;
  } catch (e) {
    return 0;
  }
}
function setLastCheckTime(timeMs) {
  try {
    localStorage.setItem(UPDATER_STORAGE_KEY, String(timeMs));
  } catch (e) {
    // If storage is unavailable, the check will simply run again next launch — harmless.
  }
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal, cache: 'no-store' })
    .finally(() => clearTimeout(timer));
}

// Fetches and validates the manifest. Never throws — returns a result object
// describing what happened, so callers can decide how loud to be about it
// (the silent weekly check vs. a manual, user-initiated check).
async function fetchManifestResult() {
  try {
    const response = await fetchWithTimeout(MANIFEST_URL, FETCH_TIMEOUT_MS);
    if (!response.ok) return { ok: false, reason: 'network' };
    const manifest = await response.json();
    if (!manifest || typeof manifest.version !== 'string') return { ok: false, reason: 'invalid' };
    return { ok: true, manifest };
  } catch (e) {
    return { ok: false, reason: 'network' };
  }
}

// Checks the manifest if due, and invokes onUpdateAvailable(manifest) if a
// newer version is found. Never throws, never blocks the caller, and does
// nothing observable when there's no update or no connectivity.
async function checkForUpdatesIfDue(onUpdateAvailable) {
  const lastCheck = getLastCheckTime();
  if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;

  const result = await fetchManifestResult();
  if (!result.ok) return; // silent — this is the background path

  setLastCheckTime(Date.now()); // only on success — a failed attempt retries next launch
  if (compareVersions(result.manifest.version, INSTALLED_VERSION) > 0) {
    onUpdateAvailable(result.manifest);
  }
}

// Manually-triggered check (e.g. a "Check for Updates Now" button). Always
// runs regardless of the 7-day gate, and reports back one of three outcomes
// via the callbacks so the caller can show appropriate (louder) feedback.
async function checkForUpdatesNow({ onUpdateAvailable, onUpToDate, onNetworkError }) {
  const result = await fetchManifestResult();
  if (!result.ok) {
    if (onNetworkError) onNetworkError();
    return;
  }
  setLastCheckTime(Date.now());
  if (compareVersions(result.manifest.version, INSTALLED_VERSION) > 0) {
    if (onUpdateAvailable) onUpdateAvailable(result.manifest);
  } else {
    if (onUpToDate) onUpToDate();
  }
}

// Downloads a URL with progress reporting: onProgress(loadedBytes, totalBytes|null).
// totalBytes is null when the server doesn't send Content-Length (progress bar
// should then show an indeterminate/spinner state). Returns a Blob of the
// full response body. Pass an AbortSignal to support cancellation.
async function downloadWithProgress(url, onProgress, signal) {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Download failed: HTTP ' + response.status);

  const totalBytes = Number(response.headers.get('content-length')) || null;
  if (!response.body || !response.body.getReader) {
    // Environment without streaming support — fall back to a single-shot download.
    const blob = await response.blob();
    if (onProgress) onProgress(blob.size, blob.size);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loadedBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loadedBytes += value.length;
    if (onProgress) onProgress(loadedBytes, totalBytes);
  }
  return new Blob(chunks);
}

if (typeof module !== 'undefined') {
  module.exports = {
    UPDATER_LOGIC_TEXT, INSTALLED_VERSION, MANIFEST_URL, CHECK_INTERVAL_MS,
    compareVersions, getLastCheckTime, setLastCheckTime,
    checkForUpdatesIfDue, checkForUpdatesNow, downloadWithProgress
  };
}
