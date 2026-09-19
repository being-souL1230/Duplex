/**
 * ChromeAdapter — Chromium family: Chrome, Edge, Brave, Opera.
 * Uses the `chrome.*` namespace (Edge/Brave/Opera alias it identically).
 */

import { WEB_APP_URL } from "../lib/constants.js";

const META_KEY = "ff_tab_meta";
let tabMeta = null;

async function loadMeta() {
  if (!tabMeta) {
    const stored = await chrome.storage.session.get(META_KEY);
    tabMeta = stored[META_KEY] ?? {};
  }
  return tabMeta;
}

async function saveMeta() {
  await chrome.storage.session.set({ [META_KEY]: tabMeta });
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

export const ChromeAdapter = {
  /** @returns {Promise<TabSnapshot[]>} */
  async getTabs() {
    const win = await chrome.windows.getLastFocused({ populate: true });
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
    const win = await chrome.windows.getLastFocused();
    await chrome.tabs.create({ windowId: win?.id, url, active });
  },

  async setBadge(hasSuggestion) {
    await chrome.action.setBadgeText({ text: hasSuggestion ? "●" : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#ffffff" });
  },

  async isLoggedIn() {
    try {
      const cookie = await chrome.cookies.get({ url: WEB_APP_URL, name: "ff_session" });
      return Boolean(cookie?.value);
    } catch {
      return false;
    }
  },

  /** In MV3 the SW dies between events, so the timer only lives per-wake. */
  scheduleDebounced(fn, ms) {
    if (ChromeAdapter._timer) clearTimeout(ChromeAdapter._timer);
    ChromeAdapter._timer = setTimeout(fn, ms);
  },

  schedulePeriodicAlarm(name, minutes) {
    chrome.alarms.create(name, { periodInMinutes: minutes });
  },

  onIdle(idleSeconds, cb) {
    chrome.idle.setDetectionInterval(idleSeconds);
    chrome.idle.onStateChanged.addListener(cb);
  },

  /** Best-effort fetch during shutdown; alarms remain the safety net. */
  async onShutdownSync(fn) {
    chrome.runtime.onSuspend.addListener(fn);
  },

  onInstalled(fn) {
    chrome.runtime.onInstalled.addListener(fn);
  },

  onStartup(fn) {
    chrome.runtime.onStartup.addListener(fn);
  },
};
