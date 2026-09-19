/**
 * signals.ts — normalizes raw tab events into lightweight context signals.
 * Only hostname / path shape / title words / timing are used. Never page content.
 */

export type RawTab = {
  tabId: number;
  url: string;
  title: string;
  openedAt?: number;
};

export type TabSignal = {
  tabId: number;
  url: string;
  hostname: string;
  host: string;
  title: string;
  words: string[];
  urlPattern: string;
  titleHash: string;
  timestamp: number;
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "in", "on", "at", "with",
  "my", "your", "new", "tab", "google", "search", "home", "page", "docs", "doc",
  "www", "com", "org", "net", "io", "app", "dev", "html",
]);

export function normalizeHostname(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return rawUrl.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase() ?? "unknown";
  }
}

/** Host "family": github.com and gist.github.com collapse to `github`. */
export function hostFamily(hostname: string): string {
  const clean = hostname.replace(/^www\./, "");
  if (clean === "localhost" || clean.startsWith("127.")) return "localhost";
  const parts = clean.split(".");
  if (parts.length <= 2) return parts[0] ?? clean;
  return parts[parts.length - 3] ?? parts[0] ?? clean;
}

/** /org/project/issues/1245 -> /org/project/issues/:id */
export function urlPattern(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname
      .split("/")
      .filter(Boolean)
      .slice(0, 3)
      .map((seg) => (/^[0-9a-f-]{6,}$/i.test(seg) || /^\d+$/.test(seg) ? ":id" : seg))
      .join("/");
    return `${normalizeHostname(rawUrl)}/${path}`;
  } catch {
    return normalizeHostname(rawUrl);
  }
}

export function titleWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 12);
}

export function titleHash(title: string): string {
  const words = titleWords(title).slice(0, 4).sort();
  return words.join("-") || "untitled";
}

export function toSignal(tab: RawTab, fallbackTime = Date.now()): TabSignal {
  const hostname = normalizeHostname(tab.url);
  return {
    tabId: tab.tabId,
    url: tab.url,
    hostname,
    host: hostFamily(hostname),
    title: tab.title,
    words: titleWords(tab.title),
    urlPattern: urlPattern(tab.url),
    titleHash: titleHash(tab.title),
    timestamp: tab.openedAt ?? fallbackTime,
  };
}

export function toSignals(tabs: RawTab[]): TabSignal[] {
  const now = Date.now();
  return tabs.map((t) => toSignal(t, now));
}
