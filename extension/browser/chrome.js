/**
 * ChromeAdapter - Chromium family: Chrome, Edge, Brave, Opera.
 * Uses the `chrome.*` namespace (Edge/Brave/Opera alias it identically).
 */

import { CANDIDATE_URLS, WEB_APP_URL, setWebAppUrl } from "../core/constants.js";
import { badgeVisual } from "../core/badgeStates.js";

const META_KEY = "dx_tab_meta";
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
    let win = null;
    try {
      win = await chrome.windows.getLastFocused({ populate: true, windowTypes: ["normal"] });
    } catch {
      /* ignore */
    }

    if (!win?.tabs || win.tabs.length === 0) {
      try {
        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
        win = windows.find((w) => w.focused) || windows[0] || null;
      } catch {
        /* ignore */
      }
    }

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

  /**
   * @param {boolean|'paused'} state true = suggestion, 'paused' = auto-detect
   *   backing off, false = nothing
   */
  async setBadge(state) {
    const v = badgeVisual(state === "paused" ? "PAUSED" : state ? "SUGGESTION" : "OFF");
    await chrome.action.setBadgeText({ text: v.text });
    await chrome.action.setBadgeBackgroundColor({ color: v.color });
    await chrome.action.setTitle({ title: v.title });
  },

  async isLoggedIn() {
    for (const url of CANDIDATE_URLS) {
      try {
        const cookie = await chrome.cookies.get({ url, name: "dx_session" });
        if (cookie?.value) {
          setWebAppUrl(url);
          return true;
        }
      } catch {
        /* ignore */
      }
    }
    return false;
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
