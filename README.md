# Duplex

**Context switching killer.** Your browser restores tabs - Duplex restores *intent*.

Duplex is a web app + browser extension built around named **Work Modes** and an
**Automatic Context Detection Engine**. A Work Mode is one coherent task ("College
Project", "Freelance Client", "Exam Prep") with its own set of resources. The engine
watches lightweight browser signals, recognises which mode you're working in, and
asks before it acts - one click rebuilds your entire workspace.

> Built for **Hack Devengers 2.0** · Open Innovation · 24-hour MVP

---

## The Problem

A browser can restore your last session, but it doesn't understand *why* those tabs
were open. 15-20 unrelated tabs, repeated searching, accidental distraction - every
context switch costs the same tax: rebuilding your workspace by hand.

## The Loop

```
Detect → Understand → Confirm → Restore → Learn
```

| Stage | What happens |
|---|---|
| **Detect** | Lightweight tab signals: hostname, URL pattern, title words, sequence, timing. Never page content. |
| **Understand** | Deterministic clustering (union-find) + explainable scoring against your modes |
| **Confirm** | High confidence only earns the right to *ask* - nothing happens silently |
| **Restore** | Only the tabs that belong to the mode open. Closing others is opt-in. |
| **Learn** | Accepted/ignored suggestions tune future detection; ignored clusters go quiet for 45 min |

## Scoring Engine (explainable, not ML)

Every point carries a human-readable reason shown in the UI:

| Signal | Weight |
|---|---|
| Resource already saved in the mode | +35 |
| Same domain cluster seen repeatedly | +20 |
| Tabs opened within a short window | +15 |
| Title keyword similarity | +15 |
| Cluster appeared in previous sessions | +15 |

Confidence bands (user-tunable in Settings): **high ≥ 70** → ask to confirm ·
**medium ≥ 45** → subtle hint · **low** → keep observing silently.

New recurring clusters that match no mode become **discovery candidates** -
"Create this mode?" - so the product learns contexts you never classified.

---

## Architecture

```
┌──────────────────────────────┐
│  Browser Extension (MV3)     │
│  tab observer · debouncer    │
│  popup UI · badge            │
└──────────────┬───────────────┘
               │ tabs snapshot (url, title, secondsAgo)
               ▼
        POST /api/detect
               │
┌──────────────▼───────────────┐
│  Detection Engine (server)   │
│  signals → clusters → score  │
│  cooldown · discovery        │
└──────────────┬───────────────┘
               │ suggestion + reasons
               ▼
        User confirms / ignores
               │
┌──────────────▼───────────────┐
│  Restore: activate mode      │
│  tabs open · session starts  │
│  real durations recorded     │
└──────────────────────────────┘
```

### Browser-agnostic extension

The engine never touches `chrome.*` / `browser.*` directly - one adapter layer:

```
Duplex Core                     Browser Adapters
├── core/api.js   (backend)        ├── browser/chrome.js   → Chrome, Edge, Brave, Opera
├── core/store.js (local state)   ├── browser/firefox.js  → Firefox (experimental)
└── detection = server /api/detect └── browser/index.js    → picks adapter
```

| Browser | Status |
|---|---|
| Chrome · Edge · Brave · Opera | ✅ primary (same build) |
| Firefox | ⚠️ experimental adapter |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Web app | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Session cookies (scrypt) + **Google OAuth 2.0** (no SDK) |
| Extension | Manifest V3, vanilla ES modules, zero build tools |
| Detection | Deterministic heuristic engine, explainable scoring |
| AI | Optional layer - the engine **never** depends on an API key |

## Screens

| Page | Purpose |
|---|---|
| `/` | Landing - product story, engine explanation, extension download |
| `/dashboard` | Overview - 7-day focus stats, accept rate, jump back into recent modes |
| `/dashboard/modes` | Work modes board - one circle per project, quick "open all links" |
| `/dashboard/modes/[id]` | Mode detail - resources, switch/restore, edit, per-mode stats |
| `/dashboard/live` | Live detection - simulated browser window running the real engine |
| `/dashboard/detection` | Engine log - every suggestion with its exact score and reasons |
| `/dashboard/sessions` | History - duration and switch counts per restored session |
| `/dashboard/settings` | Detection on/off, thresholds, tour replay, extension info |

A **guided tooltip tour** runs once for every new account and can be replayed from Settings.

---

## Quick Start

### 1. Web app

```bash
npm install
cp .env.example .env        # fill in the values (see below)
npx drizzle-kit push        # creates all tables
npm run dev                 # → http://localhost:3000
```

`.env`:

```env
DATABASE_URL="postgresql://postgres:yourpassword@127.0.0.1:5432/app_db"
APP_URL="http://localhost:3000"          # used for OAuth redirect URIs
GOOGLE_CLIENT_ID=""                      # optional - see below
GOOGLE_CLIENT_SECRET=""
```

**Google OAuth (optional):** create an OAuth 2.0 Client at
[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
and add this exact Authorized redirect URI:

```
http://localhost:3000/api/auth/google/callback
```

Without credentials the Google button hides itself; email/password auth always works.

A **demo account** seeds itself on first login page visit:
`demo@duplex.dev` / `demo1234` (pre-filled modes, sessions, detection history).
New accounts start completely clean.

### 2. Extension

The easiest path is the in-app download (landing page → *Download extension*),
which zips a fresh build server-side. For development:

1. Open `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `extension/` folder
3. Sign in on the web app - the extension shares the same session cookie
4. Browse normally; a badge appears when detection is confident, or use
   *Run detection* in the popup

Firefox (experimental): use `/api/extension/download?target=firefox` or
`about:debugging#/runtime/this-firefox` → *Load Temporary Add-on*.

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/signup` · `/login` · `/logout` | POST | Email/password auth |
| `/api/auth/google` · `/api/auth/google/callback` | GET | OAuth flow |
| `/api/detect` | POST | Cluster + score a tab snapshot → suggestion (+ `suppressed` cooldown info) |
| `/api/detections/[id]/respond` | POST | Accept / ignore a suggestion (ignored → 45-min cooldown) |
| `/api/modes` | GET · POST | List modes with links · create mode |
| `/api/modes/[id]` | GET · PATCH · DELETE | Mode detail / update / delete |
| `/api/modes/[id]/activate` | POST | Restore: validate URLs → open → record session (auto-closes previous live session) |
| `/api/modes/[id]/links` | POST | Add a resource to a mode |
| `/api/links/[id]` | DELETE | Remove a resource |
| `/api/sessions/live` | GET · POST | Live-session status · end it (real duration computed) |
| `/api/settings` | PATCH | Detection toggles, thresholds, name, tour state |
| `/api/extension/download` | GET | Fresh extension zip (`?target=firefox` for Firefox build) |
| `/api/health` | GET | Health check |

## Database

```
users            auth + preferences + detection thresholds
auth_sessions    opaque session tokens (30-day expiry)
modes            work modes (one = one project/intent)
mode_links       resources per mode (position-ordered)
sessions         restore sessions with real computed durations
context_signals  observed hostnames/title-hashes (learning data)
detection_events every suggestion: score, reasons, accepted?
```

All user-owned queries are scoped by `user_id` at the API layer; the schema
mirrors the build document's Section 7.

## Privacy Principles

- Signals are **hostname, URL shape, title words, timing** - never page content,
  form values, or keystrokes
- Detection is a visible feature with an on/off switch and an ignore action
- Nothing is created or opened without explicit confirmation
- Ignoring a suggestion both cools it down (45 min) and records the rejection

## Testing

```bash
python3 tests/extension_smoke_test.py   # 52-check integration suite (server must run)
npm run typecheck
npm run lint
```

The smoke test simulates every service-worker request and asserts the exact
response fields the extension reads - login → detect → accept/restore →
ignore → cooldown → save → session lifecycle → zip download. It is
deterministic: each run creates a fresh QA mode on fresh hostnames and
deletes it afterwards.

## Demo Script (2-3 min)

1. Sign in with `demo@duplex.dev` - modes and history are ready
2. **Live view** → *Mixed window* → **Run detection** → 92% College Project
3. **Switch to this mode** → only the 5 project resources open
4. **Detection page** → show the score's exact reasons
5. Run detection on the *Research window* → **new context discovered** → create it
6. Ignore a suggestion → re-run → engine stays quiet (cooldown)
7. **Sessions** → durations and switch counts from real restores

---

Built with ☕ and too many open tabs by **Team Hack Devengers** · Duplex · 2026
