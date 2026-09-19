/**
 * core/store.js — browser-independent state: signal buffer, suggestion,
 * live-session id. Uses the storage area via the adapter-agnostic
 * `chrome.storage`/`browser.storage` facade (both expose .local).
 */

const BUFFER_KEY = "ff_signal_buffer";
const SUGGESTION_KEY = "ff_last_suggestion";
const LIVE_SESSION_KEY = "ff_live_session_id";

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
