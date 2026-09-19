/**
 * BrowserAdapter — the ONLY place that touches browser-specific APIs.
 * The core engine never imports `chrome.*` or `browser.*` directly.
 *
 * FocusFlow Core
 *   ├── Context Detection  (core/detector — server /api/detect)
 *   ├── Clustering/Scoring (server-side, engine is deterministic)
 *   └── BrowserAdapter     ← this layer
 *         ├── chrome.js  → Chromium family (Chrome, Edge, Brave, Opera)
 *         └── firefox.js → Firefox (WebExtensions namespace)
 */

/**
 * @typedef {Object} TabSnapshot
 * @property {number} tabId
 * @property {string} title
 * @property {string} url
 * @property {number} secondsAgo  seconds since the tab was last active
 */

/**
 * @typedef {Object} Mode
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {number} useCount
 * @property {{title: string, url: string, hostname: string}[]} links
 */

/**
 * @typedef {Object} BrowserAdapter
 * @property {() => Promise<TabSnapshot[]>} getTabs
 *            current window's tabs in last-active order
 * @property {(tabId: number) => Promise<void>} touchTab
 *            record that a tab was just opened/activated/updated
 * @property {(tabId: number) => Promise<void>} forgetTab
 *            drop tab state when a tab closes
 * @property {(url: string, active: boolean) => Promise<void>} createTab
 * @property {(id: number|null, hasSuggestion: boolean) => Promise<void>} setBadge
 * @property {() => Promise<boolean>} isLoggedIn
 * @property {(ms: number, cb: () => void) => void} scheduleDebounced
 * @property {(minutes: number, cb: () => void) => void} schedulePeriodicAlarm
 * @property {(idleSeconds: number, cb: (state: string) => void) => void} onIdle
 * @property {() => Promise<void>} onShutdownSync
 */

export const SESSION_COOKIE = "ff_session";
