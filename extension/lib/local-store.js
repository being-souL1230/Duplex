/* Local state: signal buffer for auto-detection + last suggestion. */

const BUFFER_KEY = "ff_signal_buffer";
const SUGGESTION_KEY = "ff_last_suggestion";

/* Auto-detection should not run on every tab event; the doc says debounce. */
export const DEBOUNCE_MS = 12_000;

let debounceTimer = null;

/** Debounced callback scheduler — keeps a single timer across events. */
export function scheduleDebounced(fn) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, DEBOUNCE_MS);
}

export async function appendSignals(tabs) {
  const entry = { at: Date.now(), tabs };
  const { [BUFFER_KEY]: existing } = await chrome.storage.local.get(BUFFER_KEY);
  const buffer = Array.isArray(existing) ? existing : [];
  buffer.push(entry);

  /* Keep roughly the last 30 minutes of activity. */
  const cutoff = Date.now() - 30 * 60 * 1000;
  const trimmed = buffer.filter((e) => e.at >= cutoff).slice(-40);

  await chrome.storage.local.set({ [BUFFER_KEY]: trimmed });
  return trimmed;
}

export async function clearBuffer() {
  await chrome.storage.local.remove(BUFFER_KEY);
}

/** Most recent tab snapshot within `maxAgeMs`, for debounced auto-detect. */
export async function latestSnapshot(maxAgeMs = 60_000) {
  const { [BUFFER_KEY]: existing } = await chrome.storage.local.get(BUFFER_KEY);
  const buffer = Array.isArray(existing) ? existing : [];
  const last = buffer[buffer.length - 1];
  if (!last || Date.now() - last.at > maxAgeMs) return null;
  return last.tabs;
}

export async function saveSuggestion(suggestion) {
  await chrome.storage.local.set({
    [SUGGESTION_KEY]: { ...suggestion, at: Date.now() },
  });
}

export async function getSuggestion() {
  const { [SUGGESTION_KEY]: value } = await chrome.storage.local.get(SUGGESTION_KEY);
  if (!value) return null;
  /* Suggestions older than 15 minutes are stale; drop them. */
  if (Date.now() - value.at > 15 * 60 * 1000) {
    await chrome.storage.local.remove(SUGGESTION_KEY);
    return null;
  }
  return value;
}

export async function clearSuggestion() {
  await chrome.storage.local.remove(SUGGESTION_KEY);
}
