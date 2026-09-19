/**
 * core/api.js - thin API client. Every call goes through the Next.js app,
 * so authorization comes from the same dx_session cookie the website uses.
 * Pure fetch - no browser APIs here (cookie access lives in the adapter).
 *
 * Every failure is a typed ApiError so callers can decide what to retry:
 *   AUTH_REQUIRED - 401, never retry (sign in again)
 *   SERVER        - 5xx, transient: retry with backoff makes sense
 *   NETWORK       - fetch failed or timed out: transient
 *   HTTP          - any other non-ok (400/404/409...): never retry
 */

import { WEB_APP_URL } from "./constants.js";

export const API_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  /**
   * @param {string} code AUTH_REQUIRED | SERVER | NETWORK | HTTP
   * @param {string} message
   * @param {number} status HTTP status (0 for network failures/timeout)
   * @param {number} retryAfterMs server-provided Retry-After, if any
   */
  constructor(code, message, status = 0, retryAfterMs = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** True when the same request may plausibly succeed on retry. */
export function isTransient(err) {
  return err?.code === "NETWORK" || err?.code === "SERVER";
}

/** Abort the request if the server does not answer in time. */
function timeoutSignal() {
  if (typeof AbortSignal?.timeout === "function") return AbortSignal.timeout(API_TIMEOUT_MS);
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  return ctrl.signal;
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${WEB_APP_URL}${path}`, {
      credentials: "include",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: timeoutSignal(),
    });
  } catch {
    /* TypeError: connection refused / DNS / CORS; AbortError: our timeout */
    throw new ApiError("NETWORK", `network error on ${path}`);
  }

  if (res.status === 401) {
    throw new ApiError("AUTH_REQUIRED", "AUTH_REQUIRED", 401);
  }
  if (res.status >= 500) {
    const seconds = Number(res.headers.get("retry-after"));
    const retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
    throw new ApiError("SERVER", `API ${res.status} on ${path}`, res.status, retryAfterMs);
  }
  if (!res.ok) {
    throw new ApiError("HTTP", `API ${res.status} on ${path}`, res.status);
  }
  return res.json();
}

/** POST /api/detect - body tabs: [{ tabId, title, url, secondsAgo }] */
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
      description: "Saved from the Duplex extension.",
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
