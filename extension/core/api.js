/**
 * core/api.js — thin API client. Every call goes through the Next.js app,
 * so authorization comes from the same ff_session cookie the website uses.
 * Pure fetch — no browser APIs here (cookie access lives in the adapter).
 */

import { WEB_APP_URL } from "../lib/constants.js";

async function request(path, options = {}) {
  const res = await fetch(`${WEB_APP_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (res.status === 401) {
    const err = new Error("AUTH_REQUIRED");
    err.code = "AUTH_REQUIRED";
    throw err;
  }
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}

/** POST /api/detect — body tabs: [{ tabId, title, url, secondsAgo }] */
export function detect(tabs, persist = true) {
  return request("/api/detect", {
    method: "POST",
    body: JSON.stringify({ tabs, persist }),
  });
}

export function getModes() {
  return request("/api/modes");
}

export function createMode(name, links) {
  return request("/api/modes", {
    method: "POST",
    body: JSON.stringify({
      name,
      description: "Saved from the FocusFlow extension.",
      links,
    }),
  });
}

export function activateMode(modeId, source = "restored") {
  return request(`/api/modes/${modeId}/activate`, {
    method: "POST",
    body: JSON.stringify({ source }),
  });
}

export function respondToDetection(eventId, accepted, extra = {}) {
  return request(`/api/detections/${eventId}/respond`, {
    method: "POST",
    body: JSON.stringify({ accepted, ...extra }),
  });
}

export function getLiveSession() {
  return request("/api/sessions/live");
}

export function endLiveSession() {
  return request("/api/sessions/live", { method: "POST" });
}
