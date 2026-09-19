/* FocusFlow popup — talks to the service worker via chrome.runtime messages. */

const $ = (id) => document.getElementById(id);

const views = ["view-auth", "view-idle", "view-scanning", "view-suggestion", "view-restored"];

function show(viewId) {
  for (const v of views) $(v).classList.toggle("hidden", v !== viewId);
}

function setStatus(text) {
  const el = $("status");
  if (!text) {
    el.classList.add("hidden");
    return;
  }
  el.textContent = text;
  el.classList.remove("hidden");
}

function send(message) {
  return chrome.runtime.sendMessage(message);
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderSuggestion(s) {
  currentSuggestion = s;
  $("sug-score").textContent = s.score;
  $("sug-kind").textContent = s.kind === "discovery" ? "New context found" : "Looks like you're in";
  $("sug-label").textContent = s.label;
  $("sug-label").classList.toggle("hidden", s.kind === "discovery");

  const rename = $("sug-rename");
  rename.classList.toggle("hidden", s.kind !== "discovery");
  if (s.kind === "discovery" && !$("sug-name").value) {
    $("sug-name").value = s.label;
  }

  $("btn-accept").textContent = s.kind === "discovery" ? "Create this mode" : "Switch to this mode";

  const reasons = $("sug-reasons");
  reasons.replaceChildren(
    ...(s.reasons ?? []).slice(0, 3).map((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      return li;
    }),
  );

  const warning = $("sug-warning");
  if (s.switchWarning) {
    warning.textContent = `${s.switchWarning}. Stay with one mode for the next block?`;
    warning.classList.remove("hidden");
  } else {
    warning.classList.add("hidden");
  }

  show("view-suggestion");
}

function renderModes(modes) {
  const list = $("modes-list");
  if (!modes.length) {
    list.replaceChildren();
    const li = document.createElement("li");
    li.textContent = "No modes yet";
    li.style.cursor = "default";
    list.append(li);
    return;
  }
  list.replaceChildren(
    ...modes.map((m) => {
      const li = document.createElement("li");
      const icon = document.createElement("span");
      icon.textContent = m.icon ?? "◌";
      const name = document.createElement("span");
      name.textContent = m.name;
      const count = document.createElement("span");
      count.className = "m-count mono";
      count.textContent = `${m.linkCount} links`;
      li.append(icon, name, count);
      li.addEventListener("click", () => activateMode(m.id));
      return li;
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

async function refreshState() {
  try {
    const state = await send({ type: "GET_STATE" });

    if (!state.loggedIn) {
      $("btn-login").href = "http://localhost:3000/login";
      show("view-auth");
      return;
    }

    $("tab-count").textContent = `${state.tabCount} tabs`;
    renderModes(await loadModes());

    if (state.suggestion) {
      renderSuggestion(state.suggestion);
    } else {
      show("view-idle");
    }
  } catch (err) {
    setStatus(`Could not reach the web app — is it running?`);
    show("view-idle");
  }
}

async function loadModes() {
  try {
    const data = await send({ type: "LIST_MODES" });
    renderLive(data.live);
    return data.modes ?? [];
  } catch {
    return [];
  }
}

/** Small live-session indicator next to the "Saved modes" label. */
function renderLive(live) {
  const el = document.querySelector(".section-label");
  if (!el) return;
  if (live?.live && live.session) {
    const mins = Math.max(
      1,
      Math.round((Date.now() - new Date(live.session.startedAt).getTime()) / 60000),
    );
    el.textContent = `Saved modes · session live ${mins}m`;
  } else {
    el.textContent = "Saved modes";
  }
}

async function runDetection() {
  show("view-scanning");
  try {
    const data = await send({ type: "DETECT_NOW" });
    if (data.disabled) {
      setStatus("Detection is switched off in settings");
      show("view-idle");
      return;
    }
    if (data.suppressed && !data.suggestion) {
      setStatus(`“${data.suppressed.label}” cooling down — retry in ${data.suppressed.retryAfter}`);
      show("view-idle");
      return;
    }
    const suggestion = data.suggestion;
    if (suggestion) {
      renderSuggestion(suggestion);
    } else if (data.result?.candidate) {
      setStatus("Low confidence — keep observing");
      show("view-idle");
    } else {
      setStatus("No context detected in this window");
      show("view-idle");
    }
  } catch (err) {
    setStatus(err.message === "AUTH_REQUIRED" ? "Please sign in first" : "Detection failed");
    show("view-idle");
  }
}

async function acceptSuggestion() {
  const name = $("sug-name").value.trim();
  $("btn-accept").disabled = true;
  try {
    const data = await send({
      type: "ACCEPT",
      name: name || undefined,
      kind: currentSuggestion?.kind,
      label: currentSuggestion?.label,
    });
    const opened = data.opened?.length ?? 0;
    $("restored-text").textContent =
      data.label != null
        ? `Switched to ${data.label} — ${opened} resources opened.`
        : `Workspace rebuilt — ${opened} resources opened.`;
    show("view-restored");
    clearCurrentSuggestion();
    renderModes(await loadModes());
  } catch (err) {
    setStatus(err.message === "NO_MODE" ? "No mode to switch to" : "Could not switch context");
  }
  $("btn-accept").disabled = false;
}

async function ignoreSuggestion() {
  try {
    await send({ type: "IGNORE", eventId: currentSuggestion?.eventId });
    clearCurrentSuggestion();
    setStatus("Suggestion ignored");
    show("view-idle");
  } catch {
    setStatus("Could not ignore suggestion");
  }
}

async function saveTabsAsMode() {
  const name = $("save-name").value.trim();
  if (!name) {
    setStatus("Name the mode first");
    return;
  }
  try {
    const data = await send({ type: "SAVE_TABS", name });
    $("save-name").value = "";
    setStatus(`Saved ${data.count} tabs as “${name}”`);
    renderModes(await loadModes());
  } catch (err) {
    if (err.message === "NAME_REQUIRED") setStatus("Name the mode first");
    else if (err.message === "NO_TABS") setStatus("No tabs to save");
    else setStatus("Could not save tabs");
  }
}

async function activateMode(modeId) {
  try {
    const data = await send({ type: "ACTIVATE_MODE", modeId });
    const opened = data.opened?.length ?? 0;
    $("restored-text").textContent = `Restored ${opened} resources.`;
    show("view-restored");
  } catch {
    setStatus("Restore failed");
  }
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

let currentSuggestion = null;

function clearCurrentSuggestion() {
  currentSuggestion = null;
}

document.addEventListener("DOMContentLoaded", () => {
  $("btn-detect").addEventListener("click", runDetection);
  $("btn-accept").addEventListener("click", acceptSuggestion);
  $("btn-ignore").addEventListener("click", ignoreSuggestion);
  $("btn-save-tabs").addEventListener("click", saveTabsAsMode);
  $("save-name").addEventListener("keydown", (e) => e.key === "Enter" && saveTabsAsMode());
  refreshState();
});
