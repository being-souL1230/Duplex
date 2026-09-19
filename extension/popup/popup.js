/* Duplex popup - talks to the service worker via chrome.runtime messages. */

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

async function send(message) {
  const res = await chrome.runtime.sendMessage(message);
  if (res?.error) {
    const err = new Error(res.error);
    err.code = res.error;
    throw err;
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderSuggestion(s) {
  currentSuggestion = s;
  $("sug-score").textContent = s.score;
  $("sug-kind").textContent = s.kind === "discovery" ? "New context found" : "Looks like you're in";
  $("sug-label").textContent = s.label;

  const nameInput = $("sug-name");
  nameInput.value = s.label || "";

  $("btn-accept").textContent = s.kind === "discovery" ? "Save Mode" : "Switch to Mode";

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
    li.className = "empty-modes-item";
    li.textContent = "No saved modes yet";
    list.append(li);
    return;
  }
  list.replaceChildren(
    ...modes.map((m) => {
      const li = document.createElement("li");
      li.className = "mode-item";
      li.id = `mode-${m.id}`;
      li.setAttribute("data-mode-id", m.id);

      const left = document.createElement("div");
      left.className = "mode-item-left";
      const icon = document.createElement("span");
      icon.className = "m-icon";
      icon.textContent = m.icon ?? "◌";
      const name = document.createElement("span");
      name.className = "m-name";
      name.textContent = m.name;
      name.title = `Switch to "${m.name}"`;
      left.append(icon, name);

      const right = document.createElement("div");
      right.className = "mode-item-right";
      const count = document.createElement("span");
      count.className = "m-count mono";
      count.textContent = `${m.linkCount} links`;

      const delBtn = document.createElement("button");
      delBtn.className = "btn-del-mode";
      delBtn.title = `Delete "${m.name}"`;
      delBtn.setAttribute("aria-label", `Delete mode ${m.name}`);
      delBtn.innerHTML = `✕`;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showDeleteConfirm(m.id, m.name);
      });

      right.append(count, delBtn);
      li.append(left, right);
      li.addEventListener("click", () => activateMode(m.id));
      return li;
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

async function refreshState() {
  const observeStateEl = $("observe-state");
  try {
    const state = await send({ type: "GET_STATE" });

    if (!state.loggedIn) {
      const loginUrl = state.webAppUrl ? `${state.webAppUrl}/login` : "http://localhost:3001/login";
      $("btn-login").href = loginUrl;
      if (observeStateEl) {
        observeStateEl.innerHTML = `<span class="observe-dot offline"></span> not signed in`;
        observeStateEl.title = `Please sign in to the Duplex web app at ${loginUrl}`;
      }
      show("view-auth");
      return;
    }

    $("tab-count").textContent = `${state.tabCount} tabs`;
    if (state.backoffMs > 0) {
      const seconds = Math.max(1, Math.round(state.backoffMs / 1000));
      setStatus(`Auto-detect paused (${seconds}s backoff) - web app unreachable. Manual scan still available.`);
      if (observeStateEl) {
        observeStateEl.innerHTML = `<span class="observe-dot paused"></span> paused (zZ)`;
        observeStateEl.title = `Auto-detect paused (${seconds}s) due to previous server failure`;
      }
    } else {
      if (observeStateEl) {
        observeStateEl.innerHTML = `<span class="observe-dot"></span> observing`;
        observeStateEl.title = `Auto-detect active`;
      }
    }
    renderModes(await loadModes());

    if (state.suggestion) {
      renderSuggestion(state.suggestion);
    } else {
      show("view-idle");
    }
  } catch (err) {
    if (observeStateEl) {
      observeStateEl.innerHTML = `<span class="observe-dot offline"></span> offline`;
    }
    setStatus(`Could not reach the web app - is http://localhost:3000 running?`);
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
  setStatus("");
  try {
    const data = await send({ type: "DETECT_NOW" });
    if (data.disabled) {
      setStatus("Detection is switched off in settings");
      show("view-idle");
      return;
    }
    if (data.noTabs) {
      setStatus("No HTTP tabs open in this window to scan");
      show("view-idle");
      return;
    }
    if (data.suppressed && !data.suggestion) {
      setStatus(`“${data.suppressed.label}” cooling down - retry in ${data.suppressed.retryAfter}`);
      show("view-idle");
      return;
    }
    const suggestion = data.suggestion;
    if (suggestion) {
      renderSuggestion(suggestion);
    } else if (data.result?.candidate) {
      setStatus("Low confidence - keep observing");
      show("view-idle");
    } else {
      setStatus("No context detected in this window");
      show("view-idle");
    }
  } catch (err) {
    if (err.code === "AUTH_REQUIRED" || err.message === "AUTH_REQUIRED") {
      setStatus("Please sign in first (open localhost:3000/login)");
      show("view-auth");
      return;
    } else if (err.code === "NETWORK" || err.message === "NETWORK" || err.code === "SERVER" || err.message === "SERVER") {
      setStatus("Web app unreachable on localhost:3000 - is dev server running?");
    } else {
      setStatus(`Detection error: ${err.message}`);
    }
    show("view-idle");
  }
}

async function deleteModeById(modeId) {
  const confirmDelBtn = $("btn-confirm-delete");
  const confirmCancelBtn = $("btn-confirm-cancel");
  const targetLi = document.getElementById(`mode-${modeId}`) || document.querySelector(`li[data-mode-id="${modeId}"]`);

  if (confirmDelBtn) {
    confirmDelBtn.disabled = true;
    confirmDelBtn.innerHTML = `<span class="btn-spinner"></span> Deleting…`;
  }
  if (confirmCancelBtn) {
    confirmCancelBtn.disabled = true;
  }
  if (targetLi) {
    targetLi.classList.add("deleting");
  }
  setStatus("Deleting mode…");

  try {
    await send({ type: "DELETE_MODE", modeId });

    // Close confirmation modal
    hideDeleteConfirm();

    // Smoothly animate & remove the item from DOM immediately
    if (targetLi) {
      targetLi.style.transition = "all 0.2s ease";
      targetLi.style.opacity = "0";
      targetLi.style.transform = "translateX(8px)";
      setTimeout(() => {
        targetLi.remove();
        const remaining = $("modes-list")?.querySelectorAll("li.mode-item") ?? [];
        if (remaining.length === 0) {
          renderModes([]);
        }
      }, 200);
    }

    setStatus("✓ Mode deleted");
    setTimeout(() => setStatus(""), 2500);

    // Silently re-sync with server in background
    loadModes().then(renderModes).catch(() => {});
  } catch (err) {
    hideDeleteConfirm();
    if (targetLi) {
      targetLi.classList.remove("deleting");
    }
    setStatus(`Could not delete mode: ${err.message}`);
  } finally {
    if (confirmDelBtn) {
      confirmDelBtn.disabled = false;
      confirmDelBtn.textContent = "Delete";
    }
    if (confirmCancelBtn) {
      confirmCancelBtn.disabled = false;
    }
  }
}

async function acceptSuggestion() {
  const nameInput = $("sug-name");
  const name = nameInput.value.trim() || currentSuggestion?.label || "New Context";
  const btn = $("btn-accept");
  const btnIgnore = $("btn-ignore");
  const originalText = btn.textContent;
  const isDiscovery = currentSuggestion?.kind === "discovery";

  btn.disabled = true;
  btnIgnore.disabled = true;
  btn.innerHTML = `<span class="btn-spinner"></span> ${isDiscovery ? "Saving…" : "Switching…"}`;
  setStatus(isDiscovery ? "Saving mode…" : "Switching mode…");

  try {
    const data = await send({
      type: "ACCEPT",
      name: name,
      kind: currentSuggestion?.kind,
      label: name,
    });

    clearCurrentSuggestion();
    renderModes(await loadModes());

    if (data.created) {
      // Saved newly discovered cluster from open tabs!
      // Do NOT show restored view or say resources opened. Stay in idle view with confirmation.
      setStatus(`✓ Mode "${data.label || name}" saved`);
      show("view-idle");
      setTimeout(() => setStatus(""), 3000);
    } else {
      const opened = data.opened?.length ?? 0;
      $("restored-text").textContent =
        data.label != null
          ? `Switched to ${data.label} — ${opened} resources opened.`
          : `Workspace rebuilt — ${opened} resources opened.`;
      show("view-restored");
      setStatus("");
    }
  } catch (err) {
    btn.disabled = false;
    btnIgnore.disabled = false;
    btn.textContent = originalText;
    if (err.message === "NO_MODE") setStatus("No mode to switch to");
    else if (err.message === "NETWORK" || err.message === "SERVER") {
      setStatus("Web app not reachable — try again in a moment");
    } else setStatus(`Could not save: ${err.message}`);
    return;
  }
  btn.disabled = false;
  btnIgnore.disabled = false;
  btn.textContent = originalText;
}

async function ignoreSuggestion() {
  const eventId = currentSuggestion?.eventId;
  // Instant optimistic update: hide suggestion and return to idle immediately
  clearCurrentSuggestion();
  setStatus("Suggestion dismissed");
  show("view-idle");
  setTimeout(() => setStatus(""), 2000);

  // Inform background in parallel without blocking UI
  if (eventId) {
    send({ type: "IGNORE", eventId }).catch(() => {});
  }
}

async function saveTabsAsMode() {
  const nameInput = $("save-name");
  const name = nameInput.value.trim();
  if (!name) {
    setStatus("Please enter a mode name first");
    nameInput.focus();
    return;
  }
  const btn = $("btn-save-tabs");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-spinner"></span> Saving…`;
  setStatus("Saving current tabs…");

  try {
    const data = await send({ type: "SAVE_TABS", name });
    nameInput.value = "";
    setStatus(`✓ Saved "${name}" (${data.count} tabs)`);
    renderModes(await loadModes());
    setTimeout(() => setStatus(""), 3000);
  } catch (err) {
    if (err.message === "NAME_REQUIRED") setStatus("Please enter a mode name");
    else if (err.message === "NO_TABS") setStatus("No tabs to save");
    else setStatus(`Could not save mode: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
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
/* Delete Modal Confirmation                                           */
/* ------------------------------------------------------------------ */

let pendingDeleteModeId = null;

function showDeleteConfirm(modeId, modeName) {
  pendingDeleteModeId = modeId;
  $("confirm-text").textContent = `Delete “${modeName}”?`;
  $("modal-confirm").classList.remove("hidden");
}

function hideDeleteConfirm() {
  pendingDeleteModeId = null;
  $("modal-confirm").classList.add("hidden");
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

  $("btn-confirm-delete").addEventListener("click", () => {
    if (pendingDeleteModeId) {
      deleteModeById(pendingDeleteModeId);
    }
  });

  $("btn-confirm-cancel").addEventListener("click", () => {
    hideDeleteConfirm();
  });

  $("modal-confirm").addEventListener("click", (e) => {
    if (e.target.id === "modal-confirm") {
      hideDeleteConfirm();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("modal-confirm").classList.contains("hidden")) {
      hideDeleteConfirm();
    } else if (e.key === "Enter" && !$("modal-confirm").classList.contains("hidden")) {
      if (pendingDeleteModeId && !$("btn-confirm-delete").disabled) {
        deleteModeById(pendingDeleteModeId);
      }
    }
  });

  refreshState();
});
