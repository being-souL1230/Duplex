import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { getCurrentUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Serves the browser extension as a clean .zip download, built fresh on
 * every request so users always get the current build.
 *
 * ?target=firefox → Firefox build (gecko manifest becomes manifest.json)
 * default         → Chromium build (Chrome, Edge, Brave, Opera)
 */

const EXTENSION_DIR = path.join(process.cwd(), "extension");

/** Files shared by every target. */
const SHARED = [
  "browser/index.js",
  "browser/types.js",
  "browser/chrome.js",
  "browser/firefox.js",
  "core/api.js",
  "core/store.js",
  "core/constants.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

const TARGETS = {
  chromium: {
    files: ["manifest.json", "background/service-worker.js", ...SHARED],
    folder: "duplex-extension",
    filename: "duplex-extension.zip",
  },
  firefox: {
    /* The gecko manifest ships AS manifest.json inside the zip. */
    files: ["manifest.firefox.json", "background/firefox-entry.js", "background/service-worker.js", ...SHARED],
    folder: "duplex-extension-firefox",
    filename: "duplex-extension-firefox.zip",
  },
} as const;

type TargetKey = keyof typeof TARGETS;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const target: TargetKey = url.searchParams.get("target") === "firefox" ? "firefox" : "chromium";
  const config = TARGETS[target];

  const zip = new JSZip();
  const root = zip.folder(config.folder);
  if (!root) {
    return Response.json({ error: "Could not create archive" }, { status: 500 });
  }

  try {
    for (const rel of config.files) {
      const buf = await readFile(path.join(EXTENSION_DIR, rel));
      /* Firefox build: rename its manifest to the standard name. */
      const zipPath =
        target === "firefox" && rel === "manifest.firefox.json" ? "manifest.json" : rel;
      root.file(zipPath, buf);
    }
  } catch {
    return Response.json(
      { error: "Extension files missing on the server" },
      { status: 500 },
    );
  }

  const content = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${config.filename}"`,
      "Content-Length": String(content.length),
      "Cache-Control": "no-store",
    },
  });
}
