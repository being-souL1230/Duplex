/**
 * Picks the BrowserAdapter for the current runtime.
 * Detection order:
 *   1. explicit override (tests / manual pinning)
 *   2. `browser` namespace without `chrome` → Firefox
 *   3. default → Chromium family (Chrome, Edge, Brave, Opera)
 */

import { ChromeAdapter } from "./chrome.js";
import { FirefoxAdapter } from "./firefox.js";

export const BROWSERS = {
  chromium: ChromeAdapter,
  firefox: FirefoxAdapter,
};

let override = null;

export function setBrowser(name) {
  if (!BROWSERS[name]) throw new Error(`Unknown browser: ${name}`);
  override = BROWSERS[name];
}

export function getBrowser() {
  if (override) return override;

  const hasBrowserNs = typeof globalThis.browser !== "undefined";
  const hasChromeNs = typeof globalThis.chrome !== "undefined";

  /* Firefox exposes both namespaces on some versions; prefer `browser`
   * when it exists AND chrome is absent, else Chromium wins. */
  if (hasBrowserNs && !hasChromeNs) return FirefoxAdapter;
  return ChromeAdapter;
}
