/**
 * Shared badge state machine for the Duplex extension.
 *
 * One source of truth for what the toolbar badge can show, so the
 * service worker, both browser adapters and the popup agree on the
 * visuals without importing each other.
 *
 * Priority (highest wins):
 *   suggestion > paused > off
 */

export const BADGE = {
  /** A context suggestion is waiting in the popup. */
  SUGGESTION: {
    text: "●",
    color: "#7c3aed", /* purple - brand accent */
    title: "Duplex: context suggestion ready - open the popup",
  },
  /** Auto-detect is backing off because the web app is unreachable. */
  PAUSED: {
    text: "zZ",
    color: "#d97706", /* amber - needs attention but not an error */
    colorFirefox: "#ffd54d", /* brighter on Firefox's dark toolbar */
    title: "Duplex: auto-detect paused (web app unreachable) - will retry",
  },
  /** Everything nominal. */
  OFF: {
    text: "",
    color: "#7c3aed",
    title: "Duplex",
  },
};

/** Resolve the visual for a browser; Firefox toolbar is dark-themed. */
export function badgeVisual(state, isFirefox = false) {
  const def = BADGE[state] ?? BADGE.OFF;
  if (isFirefox && def.colorFirefox) {
    return { ...def, color: def.colorFirefox };
  }
  return def;
}
