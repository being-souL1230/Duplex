/**
 * core/store.js - browser-independent state: signal buffer, suggestion,
 * live-session id. Uses the storage area via the adapter-agnostic
 * `chrome.storage`/`browser.storage` facade (both expose .local).
 */

const BUFFER_KEY = "dx_signal_buffer";
const SUGGESTION_KEY = "dx_last_suggestion";
const LIVE_SESSION_KEY = "dx_live_session_id";
const BACKOFF_KEY = "dx_detect_backoff";
const BADGE_KEY = "dx_last_badge";

const area = (globalThis.browser ?? globalThis.chrome).storage.local;

export const DEBOUNCE_MS = 12_000;

export async function appendSignals(tabs) {
  const entry = { at: Date.now(), tabs };
  const { [BUFFER_KEY]: existing } = await area.get(BUFFER_KEY);
  const buffer = Array.isArray(existing) ? existing : [];
  buffer.push(entry);

  /* Keep roughly the last 30 minutes of activity. */
  const cutoff = Date.now() - 30 * 60 * 1000;
  const trimmed = buffer.filter((e) => e.at >= cutoff).slice(-40);

  await area.set({ [BUFFER_KEY]: trimmed });
  return trimmed;
}

export async function clearBuffer() {
  await area.remove(BUFFER_KEY);
}

export async function setLiveSessionId(id) {
  if (id) await area.set({ [LIVE_SESSION_KEY]: id });
  else await area.remove(LIVE_SESSION_KEY);
}

export async function getLiveSessionId() {
  const { [LIVE_SESSION_KEY]: id } = await area.get(LIVE_SESSION_KEY);
  return id ?? null;
}

export async function saveSuggestion(suggestion) {
  await area.set({ [SUGGESTION_KEY]: { ...suggestion, at: Date.now() } });
}

export async function getSuggestion() {
  const { [SUGGESTION_KEY]: value } = await area.get(SUGGESTION_KEY);
  if (!value) return null;
  if (Date.now() - value.at > 15 * 60 * 1000) {
    await area.remove(SUGGESTION_KEY);
    return null;
  }
  return value;
}

export async function clearSuggestion() {
  await area.remove(SUGGESTION_KEY);
}

/* ------------------------------------------------------------------ */
/* Detect backoff - survives service-worker restarts                    */
/*                                                                      */
/* A failed background detect must not hammer the server: after a       */
/* transient failure the next auto-detect waits failCount * DEBOUNCE_MS */
/* (capped), then resets. User-triggered detects bypass this entirely.  */
/* ------------------------------------------------------------------ */

const MAX_BACKOFF_MULTIPLIER = 10; /* cap: 10 x 12s = 2 min */

export function nextBackoffDelayMs(previousFailures, baseMs = DEBOUNCE_MS) {
  return Math.min((previousFailures + 1) * baseMs, MAX_BACKOFF_MULTIPLIER * baseMs);
}

export async function recordDetectFailure() {
  const { [BACKOFF_KEY]: backoff } = await area.get(BACKOFF_KEY);
  const failCount = (backoff?.failCount ?? 0) + 1;
  const delayMs = nextBackoffDelayMs(backoff?.failCount ?? 0);
  await area.set({ [BACKOFF_KEY]: { failCount, delayMs, at: Date.now() } });
  return { failCount, delayMs };
}

export async function clearDetectBackoff() {
  await area.remove(BACKOFF_KEY);
}

/** Returns 0 when auto-detect may run, otherwise ms to wait. */
export async function getDetectBackoffRemaining() {
  const { [BACKOFF_KEY]: backoff } = await area.get(BACKOFF_KEY);
  if (!backoff?.delayMs) return 0;
  return Math.max(0, backoff.delayMs - (Date.now() - backoff.at));
}

/* ------------------------------------------------------------------ */
/* Last badge state - lets a restarted service worker re-apply the      */
/* visual (MV3 does not keep the badge across SW deaths).               */
/* ------------------------------------------------------------------ */

export async function setLastBadgeState(name) {
  if (name) await area.set({ [BADGE_KEY]: name });
  else await area.remove(BADGE_KEY);
}

export async function getLastBadgeState() {
  const { [BADGE_KEY]: value } = await area.get(BADGE_KEY);
  return value ?? null;
}
