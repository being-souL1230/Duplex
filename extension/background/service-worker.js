/* Duplex service worker - browser-agnostic core.
 * All chrome.* and browser.* access goes through the BrowserAdapter
 * (see browser/index.js). The detection engine itself lives server-side
 * at /api/detect - the extension is a signal collector + suggester.
 *
 * Resilience rules (why this file looks defensive):
 *  - Transient detect failures (network down, 5xx) retry in-place with
 *    linear backoff, then park auto-detection in a persisted backoff so
 *    a dead server never gets hammered every 12s.
 *  - A parked auto-detect is VISIBLE: the toolbar badge shows "zZ"
 *    until the next successful detect (see core/badgeStates.js).
 *  - Non-transient failures (401, 400/404) never retry.
 *  - Every warning is logged once per SW lifetime: MV3 restarts the SW
 *    constantly, and repeating identical warnings is pure noise.
 *  - Accept paths are all-or-nothing: a mode is never half-opened, and
 *    the suggestion survives so the user can retry.
 *  - Per-tab failures during restore are skipped without losing the rest.
 */

import { getBrowser } from "../browser/index.js";
import { BADGE } from "../core/badgeStates.js";
import {
  ApiError,
  detect,
  getModes,
  createMode,
  activateMode,
  respondToDetection,
  getLiveSession,
  endLiveSession,
  isTransient,
} from "../core/api.js";
import {
  appendSignals,
  clearBuffer,
  clearSuggestion,
  saveSuggestion,
  getSuggestion,
  setLiveSessionId,
  getLiveSessionId,
  recordDetectFailure,
  clearDetectBackoff,
  getDetectBackoffRemaining,
  setLastBadgeState,
  DEBOUNCE_MS,
} from "../core/store.js";

const B = getBrowser();

const IDLE_SECONDS = 15 * 60; /* user idle this long -> session ends */
const END_PING_ALARM = "dx_end_ping";

const DETECT_RETRIES = 2; /* 1 initial try + 2 retries = 3 attempts */
const DETECT_RETRY_BASE_MS = 2_000; /* 2s, 4s between in-place retries */
const LOG_THROTTLE_MS = 60 * 60 * 1000; /* same warning again after 1h */

/* ------------------------------------------------------------------ */
/* Logging - warn once per message per SW lifetime                      */
/* ------------------------------------------------------------------ */

const warned = new Map();

/**
 * MV3 kills and restarts the service worker all the time, so repeated
 * warnings from a long-running problem (e.g. web app not running) would
 * flood the SW console. Log each message once, then stay quiet for an
 * hour before reminding once.
 */
function warnOnce(message, ...details) {
  const now = Date.now();
  const last = warned.get(message) ?? 0;
  if (now - last < LOG_THROTTLE_MS) return;
  warned.set(message, now);
  console.warn(`[Duplex] ${message}`, ...details);
}

/* ------------------------------------------------------------------ */
/* Badge - suggestion > paused > off, persisted across SW restarts      */
/* ------------------------------------------------------------------ */

function badgeStateName(state) {
  if (state === true || state === BADGE.SUGGESTION) return "suggestion";
  if (state === "paused" || state === BADGE.PAUSED) return "paused";
  return "off";
}

/**
 * Push a badge state to the browser and remember it in storage, so a
 * freshly restarted service worker can re-apply the same visual.
 * @param {true|false|"paused"} state
 */
async function setBadge(state) {
  try {
    await B.setBadge(state);
    await setLastBadgeState(badgeStateName(state));
  } catch (err) {
    /* badge is cosmetic - never let it break detection */
    console.debug("[Duplex] badge update skipped:", err?.message);
  }
}

/**
 * Recompute the badge from persisted state. Runs on install/startup
 * because MV3 does not keep the badge across service-worker deaths.
 * Priority: suggestion > paused > off.
 */
async function refreshBadgeFromState() {
  try {
    const [suggestion, backoffMs] = await Promise.all([
      getSuggestion(),
      getDetectBackoffRemaining(),
    ]);
    const state = suggestion ? true : backoffMs > 0 ? "paused" : false;
    await setBadge(state);
  } catch (err) {
    console.debug("[Duplex] badge refresh skipped:", err?.message);
  }
}

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

/**
 * One POST /api/detect with in-place retries for transient failures.
 * Backoff between retries: DETECT_RETRY_BASE_MS * attempt (2s, 4s).
 * Non-transient errors (AUTH_REQUIRED, HTTP 4xx) rethrow immediately.
 *
 * @returns the detect response
 * @throws the last error after all attempts are exhausted
 */
async function detectWithRetry(tabs) {
  let lastError = null;
  for (let attempt = 0; attempt <= DETECT_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, DETECT_RETRY_BASE_MS * attempt));
    }
    try {
      return await detect(tabs);
    } catch (err) {
      lastError = err;
      if (!isTransient(err)) throw err;
      warnOnce(
        `detect attempt ${attempt + 1}/${DETECT_RETRIES + 1} failed (${err.message}) - retrying…`,
      );
    }
  }
  throw lastError;
}

/**
 * Give auto-detection a rest after a failure so a stopped web app does
 * not get probed every debounce tick. The backoff state persists in
 * storage, so SW restarts do not reset it.
 *
 * @returns true when detection may proceed
 */
async function shouldAutoDetect() {
  const remainingMs = await getDetectBackoffRemaining();
  if (remainingMs > 0) return false;
  try {
    if (!(await B.isLoggedIn())) return false;
  } catch {
    return false; /* cookie API failed - assume logged out, retry later */
  }
  return true;
}

/** Record a failed auto-detect and log how long detection is parked. */
async function noteAutoDetectFailure(err) {
  const { failCount, delayMs } = await recordDetectFailure();
  const seconds = Math.round(delayMs / 1000);
  if (err instanceof ApiError) {
    warnOnce(
      `detect failed ${failCount}x (${err.code}: ${err.message}) - auto-detect paused ${seconds}s`,
    );
  } else {
    warnOnce(`detect failed ${failCount}x (${err.message}) - auto-detect paused ${seconds}s`);
  }
}

/** Clear backoff + badge on a definitive "no suggestion" answer. */
async function resetObservationState() {
  await clearDetectBackoff();
  await clearSuggestion();
  await setBadge(false);
}

/**
 * Run one detection cycle. The badge ALWAYS reflects the outcome
 * (suggestion / paused / off) regardless of who triggered the run -
 * a manual popup run that finds a suggestion must still light the dot,
 * and a manual run that fails must still show the paused state.
 */
async function runDetection() {
  if (!(await B.isLoggedIn())) return null;

  const tabs = await B.getTabs();
  if (tabs.length === 0) return null;

  await appendSignals(tabs);

  let data;
  try {
    data = await detectWithRetry(tabs);
  } catch (err) {
    if (err?.code === "AUTH_REQUIRED") throw err;
    await noteAutoDetectFailure(err);
    /* Show the parked state even when the popup triggered the run -
     * it is a status change, not a cosmetic notification. */
    await setBadge("paused");
    throw err;
  }

  /* A clean answer means the server is healthy again. */
  await clearDetectBackoff();

  if (data.disabled || !data.result?.candidate) {
    await resetObservationState();
    return data;
  }

  const candidate = data.result.candidate;
  if (candidate.confidence === "low") {
    /* Doc: low -> keep observing, no UI. Stale badges still clear. */
    await setBadge(false);
    return data;
  }

  await saveSuggestion({
    eventId: data.eventId,
    kind: candidate.kind,
    label: candidate.label,
    score: candidate.score,
    confidence: candidate.confidence,
    reasons: candidate.reasons,
    tabIds: candidate.tabIds,
    tabs: candidate.tabs,
    modeId: candidate.modeId,
    switchWarning: data.result.switchWarning,
  });
  await setBadge(true);
  return data;
}

/* ------------------------------------------------------------------ */
/* Restore                                                             */
/* ------------------------------------------------------------------ */

/**
 * Open tabs with a small gap: the browser's window lookup can race a
 * freshly focused window, and hammering tabs.create all at once can drop
 * tabs. A failed tab is skipped (and logged) instead of losing the rest.
 */
async function openTabsSequentially(opened) {
  const results = [];
  for (let i = 0; i < opened.length; i += 1) {
    const url = opened[i]?.url;
    if (!url) {
      warnOnce("mode link without url skipped during restore");
      continue;
    }
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 120));
    try {
      await B.createTab(url, i === 0);
      results.push(url);
    } catch (err) {
      warnOnce(`could not open tab ${url}`, err?.message);
    }
  }
  return results;
}

async function restoreMode(modeId, source) {
  const data = await activateMode(modeId, source);

  /* Remember which session we started so the alarm can reconcile it. */
  if (data.session?.id) {
    await setLiveSessionId(data.session.id);
  }

  const openedUrls = await openTabsSequentially(data.opened ?? []);
  return { ...data, opened: openedUrls };
}

/* ------------------------------------------------------------------ */
/* Session lifecycle - sessions must record real durations              */
/* ------------------------------------------------------------------ */

async function autoEndSession(reason) {
  try {
    if (!(await B.isLoggedIn())) return;

    const data = await endLiveSession();
    if (data.closed > 0) {
      console.info(`[Duplex] session ended (${reason}), duration recorded`);
    }
  } catch (err) {
    if (err.code !== "AUTH_REQUIRED") {
      warnOnce(`autoEnd failed (${reason})`, err.message);
    }
  }
}

/**
 * Safety net: onSuspend is best-effort, so a periodic alarm also
 * reconciles the live session. If the server's live session differs
 * from the one we started, end it.
 */
async function reconcileSession() {
  try {
    if (!(await B.isLoggedIn())) return;
    const knownId = await getLiveSessionId();
    const data = await getLiveSession();
    if (data.live && knownId && data.session.id !== knownId) {
      await endLiveSession(); /* stale live session from an old run */
    }
  } catch (err) {
    if (err.code !== "AUTH_REQUIRED") warnOnce("reconcile failed", err.message);
  }
}

B.onIdle(IDLE_SECONDS, (state) => {
  if (state === "idle" || state === "locked") autoEndSession("idle");
});

B.onShutdownSync(() => autoEndSession("shutdown"));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === END_PING_ALARM) reconcileSession();
});

/* Alarms persist across service-worker restarts; create if missing.
 * The badge does NOT persist visually - recompute it from storage. */
B.onInstalled(() => {
  B.schedulePeriodicAlarm(END_PING_ALARM, 10);
  refreshBadgeFromState();
});
B.onStartup(() => {
  B.schedulePeriodicAlarm(END_PING_ALARM, 10);
  reconcileSession();
  refreshBadgeFromState();
});

/* ------------------------------------------------------------------ */
/* Tab event listeners - browser-agnostic via adapter                  */
/* ------------------------------------------------------------------ */

function scheduleAutoDetect() {
  B.scheduleDebounced(async () => {
    if (!(await shouldAutoDetect())) return;
    try {
      await runDetection();
    } catch {
      /* Failure (backoff + zZ badge) was already recorded in runDetection. */
      console.debug("[Duplex] auto-detect skipped after failure (backoff active)");
    }
  }, DEBOUNCE_MS);
}

chrome.tabs.onCreated.addListener((tab) => {
  B.touchTab(tab.id).catch(() => {});
  scheduleAutoDetect();
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  B.touchTab(tabId).catch(() => {});
  scheduleAutoDetect();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") {
    B.touchTab(tabId).catch(() => {});
    scheduleAutoDetect();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  B.forgetTab(tabId).catch(() => {});
  scheduleAutoDetect();
});

/* ------------------------------------------------------------------ */
/* Popup message API                                                   */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.code ?? err.message }));
  return true; /* async response */
});

async function handleMessage(message = {}) {
  switch (message.type) {
    case "GET_STATE": {
      const [loggedIn, suggestion, backoffMs] = await Promise.all([
        B.isLoggedIn(),
        getSuggestion(),
        getDetectBackoffRemaining(),
      ]);
      const tabs = loggedIn ? await B.getTabs() : [];
      return {
        loggedIn,
        suggestion,
        tabCount: tabs.length,
        debounceMs: DEBOUNCE_MS,
        backoffMs,
      };
    }

    case "DETECT_NOW": {
      const data = await runDetection();
      const suggestion = await getSuggestion();
      return {
        result: data?.result ?? null,
        eventId: data?.eventId ?? null,
        disabled: Boolean(data?.disabled),
        suppressed: data?.suppressed ?? null,
        suggestion,
      };
    }

    case "ACCEPT": {
      const suggestion = await getSuggestion();
      const eventId = message.eventId ?? suggestion?.eventId;
      let modeId = message.modeId ?? suggestion?.modeId ?? null;

      if (eventId) {
        const responded = await respondToDetection(eventId, true, {
          createMode: message.kind === "discovery",
          name: message.name,
          tabs: suggestion?.tabs ?? [],
        });
        modeId = responded.modeId ?? modeId;
      }
      if (!modeId) throw new Error("NO_MODE");

      /* All-or-nothing: activate + open tabs before clearing the
       * suggestion, so a failed restore leaves the card retryable. */
      const restored = await restoreMode(modeId, "detected");
      await clearSuggestion();
      await setBadge(false);
      return {
        ok: true,
        opened: restored.opened ?? [],
        label: message.label,
        sessionId: restored.session?.id ?? null,
      };
    }

    case "IGNORE": {
      const suggestion = await getSuggestion();
      const eventId = message.eventId ?? suggestion?.eventId;
      if (eventId) {
        /* Ignore must always clear local state; a server failure here
         * should not leave a dead suggestion stuck in the popup. */
        await respondToDetection(eventId, false).catch((err) => {
          if (err.code !== "AUTH_REQUIRED") warnOnce("ignore response not recorded", err.message);
        });
      }
      await clearSuggestion();
      await setBadge(false);
      await clearBuffer();
      return { ok: true };
    }

    case "SAVE_TABS": {
      const name = (message.name ?? "").trim();
      if (!name) throw new Error("NAME_REQUIRED");
      const tabs = await B.getTabs();
      if (tabs.length === 0) throw new Error("NO_TABS");
      await createMode(
        name,
        tabs.map((t) => ({ title: t.title, url: t.url })),
      );
      return { ok: true, count: tabs.length };
    }

    case "LIST_MODES": {
      const data = await getModes();
      return {
        modes: (data.modes ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          icon: m.icon,
          useCount: m.useCount,
          linkCount: m.links?.length ?? 0,
        })),
        live: await getLiveSession().catch(() => ({ live: false })),
      };
    }

    case "ACTIVATE_MODE": {
      const restored = await restoreMode(message.modeId, "restored");
      return { ok: true, opened: restored.opened ?? [] };
    }

    default:
      throw new Error("UNKNOWN_MESSAGE");
  }
}
