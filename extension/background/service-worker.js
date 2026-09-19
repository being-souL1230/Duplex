/* Duplex service worker - browser-agnostic core.
 * All chrome.* and browser.* access goes through the BrowserAdapter
 * (see browser/index.js). The detection engine itself lives server-side
 * at /api/detect - the extension is a signal collector + suggester.
 */

import { getBrowser } from "../browser/index.js";
import {
  detect,
  getModes,
  createMode,
  activateMode,
  respondToDetection,
  isLoggedIn,
  getLiveSession,
  endLiveSession,
} from "../core/api.js";
import {
  appendSignals,
  clearBuffer,
  clearSuggestion,
  saveSuggestion,
  getSuggestion,
  setLiveSessionId,
  getLiveSessionId,
  DEBOUNCE_MS,
} from "../core/store.js";

const B = getBrowser();

const IDLE_SECONDS = 15 * 60; /* user idle this long -> session ends */
const END_PING_ALARM = "dx_end_ping";

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

async function setBadge(hasSuggestion) {
  try {
    await B.setBadge(hasSuggestion);
  } catch {
    /* badge is cosmetic - never let it break detection */
  }
}

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

async function runDetection({ notifyBadge = true } = {}) {
  if (!(await isLoggedIn())) return null;

  const tabs = await B.getTabs();
  if (tabs.length === 0) return null;

  await appendSignals(tabs);

  const data = await detect(tabs);
  if (data.disabled || !data.result?.candidate) {
    await clearSuggestion();
    if (notifyBadge) await setBadge(false);
    return data;
  }

  const candidate = data.result.candidate;
  if (candidate.confidence === "low") {
    /* Doc: low -> keep observing, no UI. */
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
  if (notifyBadge) await setBadge(true);
  return data;
}

/* ------------------------------------------------------------------ */
/* Restore                                                             */
/* ------------------------------------------------------------------ */

async function restoreMode(modeId, source) {
  const data = await activateMode(modeId, source);

  /* Remember which session we started so the alarm can reconcile it. */
  if (data.session?.id) {
    await setLiveSessionId(data.session.id);
  }

  const opened = data.opened ?? [];
  for (let i = 0; i < opened.length; i += 1) {
    await B.createTab(opened[i].url, i === 0);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Session lifecycle - sessions must record real durations              */
/* ------------------------------------------------------------------ */

async function autoEndSession(reason) {
  try {
    if (!(await isLoggedIn())) return;

    const data = await endLiveSession();
    if (data.closed > 0) {
      console.info(`[Duplex] session ended (${reason}), duration recorded`);
    }
  } catch (err) {
    if (err.code !== "AUTH_REQUIRED") {
      console.warn("[Duplex] autoEnd failed:", err.message);
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
    if (!(await isLoggedIn())) return;
    const knownId = await getLiveSessionId();
    const data = await getLiveSession();
    if (data.live && knownId && data.session.id !== knownId) {
      await endLiveSession(); /* stale live session from an old run */
    }
  } catch (err) {
    if (err.code !== "AUTH_REQUIRED") console.warn("[Duplex] reconcile failed:", err.message);
  }
}

B.onIdle(IDLE_SECONDS, (state) => {
  if (state === "idle" || state === "locked") autoEndSession("idle");
});

B.onShutdownSync(() => autoEndSession("shutdown"));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === END_PING_ALARM) reconcileSession();
});

/* Alarms persist across service-worker restarts; create if missing. */
B.onInstalled(() => {
  B.schedulePeriodicAlarm(END_PING_ALARM, 10);
});
B.onStartup(() => {
  B.schedulePeriodicAlarm(END_PING_ALARM, 10);
  reconcileSession();
});

/* ------------------------------------------------------------------ */
/* Tab event listeners - browser-agnostic via adapter                  */
/* ------------------------------------------------------------------ */

function scheduleAutoDetect() {
  B.scheduleDebounced(() => {
    runDetection().catch((err) => {
      if (err.code !== "AUTH_REQUIRED") console.warn("[Duplex] detect failed:", err.message);
    });
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
      const [loggedIn, suggestion] = await Promise.all([isLoggedIn(), getSuggestion()]);
      const tabs = loggedIn ? await B.getTabs() : [];
      return { loggedIn, suggestion, tabCount: tabs.length, debounceMs: DEBOUNCE_MS };
    }

    case "DETECT_NOW": {
      const data = await runDetection({ notifyBadge: false });
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
      if (eventId) await respondToDetection(eventId, false);
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
