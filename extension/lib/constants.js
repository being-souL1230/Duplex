/* Shared constants and tiny helpers for the FocusFlow extension. */

export const WEB_APP_URL = "http://localhost:3000";
const SESSION_COOKIE = "ff_session";

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
