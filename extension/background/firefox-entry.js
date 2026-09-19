/**
 * Firefox entry point.
 *
 * Firefox (Manifest V3 / event pages, and MV2 background scripts) evaluates
 * background files where the global `browser` namespace exists. Importing
 * this module first pins the FirefoxAdapter before service-worker.js
 * selects the adapter, then re-exports the shared logic.
 */

import { setBrowser } from "../browser/index.js";

setBrowser("firefox");

/* Shared worker logic runs against the pinned adapter. */
await import("./service-worker.js");
