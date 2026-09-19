/* Thin API client: every call goes through the Next.js app, so all
 * authorization comes from the same ff_session cookie the website uses. */

import { WEB_APP_URL, getCookie, jsonHeaders } from "./constants.js";

const SESSION_COOKIE = "ff_session";

async function request(path, options = {}) {
  const res = await fetch(`${WEB_APP_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: jsonHeaders(options.headers),
  });
  if (res.status === 401) {
    const err = new Error("AUTH_REQUIRED");
    err.code = "AUTH_REQUIRED";
    throw err;
  }
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}`);
  }
  return res.json();
}

export async function isLoggedIn() {
  return Boolean(await getCookie(SESSION_COOKIE));
}

export function loginUrl() {
  return `${WEB_APP_URL}/login`;
}

/** POST /api/detect — body tabs: [{ tabId, title, url, secondsAgo }] */
export function detect(tabs, persist = true) {
  return request("/api/detect", {
    method: "POST",
    body: JSON.stringify({ tabs, persist }),
  });
}

/** GET /api/modes — all modes with their links */
export function getModes() {
  return request("/api/modes");
}

/** POST /api/modes — create a mode with links */
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

/** POST /api/modes/:id/activate — restore + session record */
export function activateMode(modeId, source = "restored") {
  return request(`/api/modes/${modeId}/activate`, {
    method: "POST",
    body: JSON.stringify({ source }),
  });
}

/** GET /api/sessions/live — is there a live session right now? */
export function getLiveSession() {
  return request("/api/sessions/live");
}

/** POST /api/sessions/live — end the live session (idle / shutdown). */
export function endLiveSession() {
  return request("/api/sessions/live", { method: "POST" });
}

/** POST /api/detections/:id/respond — accept / ignore a suggestion */
export function respondToDetection(eventId, accepted, extra = {}) {
  return request(`/api/detections/${eventId}/respond`, {
    method: "POST",
    body: JSON.stringify({ accepted, ...extra }),
  });
}
