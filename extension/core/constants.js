/* Shared constants and tiny helpers for the Duplex extension. */

export const CANDIDATE_URLS = [
  "http://localhost:3001",
  "http://localhost:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3000",
];

export let WEB_APP_URL = "http://localhost:3001";

export function setWebAppUrl(url) {
  if (url && typeof url === "string") {
    WEB_APP_URL = url;
  }
}

const SESSION_COOKIE = "dx_session";

export async function getCookie(name) {
  try {
    const cookie = await chrome.cookies.get({
      url: WEB_APP_URL,
      name,
    });
    return cookie?.value ?? null;
  } catch {
    return null;
  }
}

export function jsonHeaders(value) {
  return { "Content-Type": "application/json", ...value };
}
