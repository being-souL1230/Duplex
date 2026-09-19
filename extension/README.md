# Duplex Browser Extension

Manifest V3 extension that observes real browser tabs, sends them to the
Duplex web app's detection engine (`/api/detect`), and restores work modes
in one click. Built browser-agnostic on purpose:

```
Duplex Core                    browser adapters
├── core/api.js  (backend calls)  ├── browser/chrome.js   Chromium
├── core/store.js (state)         ├── browser/firefox.js  Firefox
└── detection = server /api/detect└── browser/index.js     picks adapter
```

The engine never touches `chrome.*` / `browser.*` directly - every platform
quirk lives in one adapter file.

## Browser compatibility

| Browser   | Engine   | Status | Download |
|-----------|----------|--------|----------|
| Chrome    | Chromium | ✅ primary target | `/api/extension/download` |
| Edge      | Chromium | ✅ same build | same zip |
| Brave     | Chromium | ✅ same build | same zip |
| Opera     | Chromium | ✅ same build | same zip |
| Firefox   | Gecko    | ⚠️ experimental adapter | `/api/extension/download?target=firefox` |

Chromium browsers share the same zip. The Firefox zip differs only in its
manifest (`browser_specific_settings.gecko`) and its background entry
(`firefox-entry.js` pins the FirefoxAdapter).

## Setup (load unpacked)

1. Run the web app: `npm run dev` → http://localhost:3000
2. Sign in at http://localhost:3000/login (demo: `demo@duplex.dev` / `demo1234`)
3. Open `chrome://extensions` (or `about:debugging#/runtime/this-firefox`)
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** → select this `extension/` folder (Chromium)
   - for Firefox, zip the folder with `manifest.firefox.json` renamed to
   `manifest.json`, or use Debug Add-ons → Load Temporary Add-on
6. Pin Duplex to the toolbar

The extension reuses the web app's `dx_session` cookie (needs the `cookies`
permission + `host_permissions` for localhost), so there is no separate login.

## What it does

| Piece | File | Role (doc §6.1) |
|---|---|---|
| Service worker | `background/service-worker.js` | Tab listeners, debounced auto-detect, badge, restore |
| API client | `core/api.js` | `/api/detect`, `/api/modes`, activate, respond |
| Local state | `core/store.js` | Signal buffer, debouncer, last suggestion |
| Browser adapter | `browser/*` | `BrowserAdapter` interface: `chrome.js` (Chromium), `firefox.js` (Firefox), `index.js` (selector) |
| Popup | `popup/*` | Current context card, reasons, accept/ignore, saved modes |

### Flow

```
chrome.tabs.onCreated/onActivated/onUpdated/onRemoved
        │  (last-active timestamps kept in chrome.storage.session)
        ▼
debounce 12s  →  snapshot current window (url, title, secondsAgo)
        ▼
POST /api/detect   →  cluster + score (same engine as the web app)
        ▼
medium/high confidence  →  badge "●" + suggestion in popup
        ▼
[Switch to this mode]  →  respond accepted → activate mode
                          → chrome.tabs.create for each link
                          → session + signals recorded server-side
```

Low confidence stays silent (doc: "keep observing"). Ignoring clears the
buffer and records `accepted=false` so the engine learns.

## Privacy

Same contract as the web app: hostname, URL, title, timing only. No page
content, no form values, no keystrokes. Detection is a visible feature with a
clear suggestion card and an explicit ignore action.
