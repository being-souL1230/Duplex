/**
 * FirefoxAdapter - Firefox uses the `browser.*` namespace with promise-based
 * WebExtensions APIs. Differences from Chromium handled here:
 *
 * 1. `browser.action` (same as chrome.action in FF ≥109).
 * 2. No `chrome.storage.session` in older versions → use storage.local.
 * 3. `windows.getLastFocused({populate})` - same, but returns promises
 *    natively (no callback form needed).
 * 4. `runtime.onSuspend` does not fire reliably → alarms reconcile instead.
 * 5. `idle.setDetectionInterval` exists; idle events work the same.
 */

import { WEB_APP_URL } from "../core/constants.js";
import { badgeVisual } from "../core/badgeStates.js";

const META_KEY = "dx_tab_meta";
let tabMeta = null;

/** Firefox global `browser` namespace (declared by the runtime). */
const api = globalThis.browser ?? globalThis.chrome;

async function loadMeta() {
  if (!tabMeta) {
    const stored = await api.storage.local.get(META_KEY);
    tabMeta = stored[META_KEY] ?? {};
  }
  return tabMeta;
}

async function saveMeta() {
  await api.storage.local.set({ [META_KEY]: tabMeta });
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

export const FirefoxAdapter = {
  /** @returns {Promise<TabSnapshot[]>} */
  async getTabs() {
    const win = await api.windows.getLastFocused({ populate: true });
    const meta = await loadMeta();
    const now = Date.now();

    return (win?.tabs ?? [])
      .filter((t) => isHttpUrl(t.url))
      .map((t) => ({
        tabId: t.id,
        title: t.title ?? "",
        url: t.url,
        lastActive: meta[t.id] ?? now - 30_000,
      }))
      .sort((a, b) => a.lastActive - b.lastActive)
      .map((t) => ({
        tabId: t.tabId,
        title: t.title,
        url: t.url,
        secondsAgo: Math.min(3600, Math.max(0, Math.round((now - t.lastActive) / 1000))),
      }));
  },

  async touchTab(tabId) {
    const meta = await loadMeta();
    meta[tabId] = Date.now();
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const id of Object.keys(meta)) {
      if (meta[id] < cutoff) delete meta[id];
    }
    await saveMeta();
  },

  async forgetTab(tabId) {
    await loadMeta();
    delete tabMeta[tabId];
    await saveMeta();
  },

  async createTab(url, active) {
    const win = await api.windows.getLastFocused();
    await api.tabs.create({ windowId: win?.id, url, active });
  },

  /**
   * @param {boolean|'paused'} state true = suggestion, 'paused' = auto-detect
   *   backing off, false = nothing
   */
  async setBadge(state) {
    const v = badgeVisual(state === "paused" ? "PAUSED" : state ? "SUGGESTION" : "OFF", true);
    await api.action.setBadgeText({ text: v.text });
    await api.action.setBadgeBackgroundColor({ color: v.color });
    await api.action.setTitle({ title: v.title });
  },

  async isLoggedIn() {
    try {
      const cookie = await api.cookies.get({ url: WEB_APP_URL, name: "dx_session" });
      return Boolean(cookie?.value);
    } catch {
      return false;
    }
  },

  /**
   * Firefox (non-MV3-event-page quirks): background scripts persist longer,
   * but a plain setTimeout is still the right debounce primitive.
   */
  scheduleDebounced(fn, ms) {
    if (FirefoxAdapter._timer) clearTimeout(FirefoxAdapter._timer);
    FirefoxAdapter._timer = setTimeout(fn, ms);
  },

  schedulePeriodicAlarm(name, minutes) {
    api.alarms.create(name, { periodInMinutes: minutes });
  },

  onIdle(idleSeconds, cb) {
    api.idle.setDetectionInterval(idleSeconds);
    api.idle.onStateChanged.addListener(cb);
  },

  async onShutdownSync(fn) {
    /* Not fired reliably in Firefox - the periodic alarm reconciles instead. */
    if (api.runtime.onSuspend) api.runtime.onSuspend.addListener(fn);
  },

  onInstalled(fn) {
    api.runtime.onInstalled.addListener(fn);
  },

  onStartup(fn) {
    api.runtime.onStartup.addListener(fn);
  },
};
