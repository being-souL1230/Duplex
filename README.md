# Duplex

Context switching solution for modern knowledge workers. Browsers restore tabs, but Duplex restores intent.

Duplex is a web platform and browser extension engineered around named Work Modes and an Automatic Context Detection Engine. A Work Mode represents a distinct, coherent task (such as a college project, freelance client engagement, or exam preparation) along with its curated resources. The detection engine observes lightweight browser signals, determines which task context you are operating in, and presents a single-click action to restore your intended workspace.

---

## Table of Contents

1. Problem Statement
2. The Five-Stage Operational Loop
3. Heuristic Scoring Engine
4. System Architecture
5. Browser Extension and Adapter Architecture
6. Database Schema and Entity Relations
7. Application Screens and User Interface
8. Complete API Reference
9. Privacy and Security Model
10. Setup and Installation
11. Testing and Quality Assurance
12. Demonstration Walkthrough

---

## 1. Problem Statement

Modern browser sessions accumulate dozens of open tabs across disconnected tasks: source code repositories, technical documentation, issue trackers, communication channels, and research references. Standard browser session managers treat tabs as flat, unrelated URLs. When users switch tasks, they face a severe context switching tax:

- Manual triage: Sifting through 15 to 30 tabs to locate relevant documents.
- Disrupted focus: Accidental distraction from unrelated background tabs.
- Lost state: Inability to save, switch between, and restore coherent task workspaces on demand.

Duplex resolves this by binding resources to explicit Work Modes and running an explainable, deterministic detection engine that recognizes task transitions in real time.

---

## 2. The Five-Stage Operational Loop

The system operates across five distinct phases:

```
Detect -> Understand -> Confirm -> Restore -> Learn
```

### Stage Breakdown

- Detect: Lightweight tab signals are captured by the browser extension or simulated console. These include hostnames, URL patterns, title keywords, sequential order, and time proximity. Raw page content, DOM trees, input forms, and keystrokes are never read.
- Understand: A deterministic clustering algorithm (Union-Find connected components) groups related tabs into clusters. Each cluster is evaluated against saved Work Modes and unclassified workflow patterns using an explainable scoring heuristic.
- Confirm: Non-intrusive user control. High-confidence detections earn the right to ask for confirmation via an extension badge or prompt. The system never opens or modifies tabs silently.
- Restore: Restoring a mode opens only the links assigned to that specific mode. Closing unrelated tabs is strictly opt-in and disabled by default.
- Learn: User actions (accepting or ignoring suggestions) update heuristic state and trigger an automated cooldown mechanism to prevent repetitive prompts.

---

## 3. Heuristic Scoring Engine

Duplex implements an explainable, deterministic heuristic engine rather than a black-box machine learning model. This ensures zero API latency, zero token costs, total privacy, and human-readable justifications for every score.

### Signal Weights for Mode Matching

Every point added to a candidate score is accompanied by a plain-language explanation displayed in the user interface:

| Signal | Maximum Points | Description |
|---|---|---|
| Known Resource Match | +35 | Domain or URL already exists in the target Work Mode |
| Repeated Domain Frequency | +20 | Domain observed 3 or more times in user history |
| Temporal Window Proximity | +15 | Tabs launched in rapid succession (within 240 seconds) |
| Title Keyword Overlap | +15 | Sanitized title tokens matching mode name or resource titles |
| Historical Session Recurrence | +15 | Cluster appeared in 2 or more previous sessions with matching hosts |
| Host Family Association | +8 | Cross-subdomain match within the same organization (e.g. gist.github.com) |

### Discovery Scoring for Unclassified Contexts

When a user works across related resources that do not match any existing Work Mode, the engine scores the cluster as a discovery candidate:

| Signal | Points | Condition |
|---|---|---|
| Cluster Density | +25 | 3 or more related resources opened together (+12 for 2 resources) |
| Session Repetition | +35 | Cluster hostnames observed across 3 or more past sessions (+18 for 1 session) |
| Burst Activity | +15 | Tabs opened within a compact 240-second window |
| Vocabulary Cohesion | +10 | Tabs share 4 or more distinct non-stop-word title terms |

When a discovery candidate crosses the threshold, Duplex prompts the user to create a new Work Mode directly from the active tabs.

### Confidence Thresholds

Thresholds can be adjusted in user settings:

- High Confidence (Score >= 70): Triggers an active prompt and badge notification to restore or switch mode.
- Medium Confidence (Score >= 45): Displays a subtle notification indicator in the extension popup.
- Low Confidence (Score < 45): Remains silent and continues background observation without user interruption.

### Cooldown and Anti-Nagging Logic

When a user ignores or rejects a suggestion:

- The event is logged with accepted=false to preserve training feedback.
- A cooldown timer is activated (default 2-minute suppression over a 10-minute window).
- Suppression checks operate at two levels:
  1. Mode-level: The same mode will not be suggested again during cooldown.
  2. Cluster-level: Any cluster sharing 2 or more hostnames with an ignored suggestion is suppressed.
- Manual forced detection (via the Live Console or extension popup) can bypass active cooldowns.

---

## 4. System Architecture

Duplex consists of a Next.js full-stack application, a PostgreSQL database managed by Drizzle ORM, and a browser-agnostic Manifest V3 extension.

```
+-------------------------------------------------------+
|                Browser Extension (MV3)                |
|  Tab Observers  |  12s Debouncer  |  Badge Controller |
+---------------------------+---------------------------+
                            | Tabs snapshot (url, title, secondsAgo)
                            v
+-------------------------------------------------------+
|             Next.js Server (/api/detect)              |
|  Signal Normalizer -> Union-Find -> Heuristic Scorer  |
|  Cooldown Validator -> Discovery Classifier           |
+---------------------------+---------------------------+
                            | Suggestion + Reasons Breakdown
                            v
+-------------------------------------------------------+
|                    User Interaction                   |
|       Accept / Switch Mode       |       Ignore       |
+---------------------------+------+--------------------+
                            |                           |
                            v                           v
+---------------------------------------+   +-----------+-----------+
|        Mode Restoration & Session     |   |   Cooldown Activated  |
|  Target URLs opened in browser        |   |   Cluster quieted     |
|  Active session duration tracked      |   |   Feedback recorded   |
+---------------------------------------+   +-----------------------+
```

### Technology Stack

- Web Framework: Next.js 16 (App Router), React 19, TypeScript
- Styling: Tailwind CSS 4 with custom dark aesthetic and responsive UI
- Database: PostgreSQL with Drizzle ORM and Drizzle Kit migrations
- Authentication: Opaque session tokens with Node.js crypto scrypt hashing, plus native Google OAuth 2.0
- Extension: Manifest V3, ES Modules, native browser APIs, zero external bundlers
- Packaging: Dynamic in-memory zip compilation via JSZip (`/api/extension/download`)

---

## 5. Browser Extension and Adapter Architecture

The browser extension is built using an Adapter Pattern. The core logic does not make direct vendor API calls (`chrome.*` or `browser.*`). Instead, all browser operations route through an abstraction layer.

### Component Directory

```
extension/
|-- manifest.json                 Chromium Manifest V3
|-- manifest.firefox.json         Gecko Manifest V3
|-- background/
|   |-- service-worker.js         Core lifecycle, tab observers, debouncing, restore
|   `-- firefox-entry.js          Firefox background entry point
|-- browser/
|   |-- index.js                  Adapter factory (environment detection)
|   |-- types.js                  BrowserAdapter contract interface
|   |-- chrome.js                 Chromium implementation (Chrome, Edge, Brave, Opera)
|   `-- firefox.js                Gecko implementation (Firefox)
|-- core/
|   |-- api.js                    Client for Duplex backend endpoints
|   |-- store.js                  Local buffer, session persistence, debouncing
|   |-- constants.js              URL configurations and header helpers
|   `-- badgeStates.js            Toolbar icon badge definitions
`-- popup/
    |-- popup.html                Extension popup user interface
    |-- popup.css                 Scoped popup styling
    `-- popup.js                  Popup controller and interaction logic
```

### Browser Support Matrix

| Browser | Engine | Status | Package Endpoint |
|---|---|---|---|
| Google Chrome | Chromium | Primary Target | `/api/extension/download` |
| Microsoft Edge | Chromium | Fully Supported | `/api/extension/download` |
| Brave Browser | Chromium | Fully Supported | `/api/extension/download` |
| Opera | Chromium | Fully Supported | `/api/extension/download` |
| Mozilla Firefox | Gecko | Supported Adapter | `/api/extension/download?target=firefox` |

### Extension Lifecycle and Session Sharing

1. Single Sign-On: The extension shares the web application's `dx_session` HTTP cookie across localhost, requiring no separate extension login.
2. Event Debouncing: Tab operations (`onCreated`, `onActivated`, `onUpdated`, `onRemoved`) update an in-memory buffer. Telemetry snapshots are debounced to fire only after 12 seconds of stability.
3. Persistent State: Active tab timestamps are tracked in `chrome.storage.session` to measure dwell time and recency.
4. Auto-Idle Session Closure: An alarm monitors system idle state. If the user is idle for 15 minutes, the current active mode session is closed on the server.

---

## 6. Database Schema and Entity Relations

The PostgreSQL database schema is managed via Drizzle ORM in `src/db/schema.ts`. All user-specific queries enforce strict multi-tenant isolation via `userId` scoping.

### Entity Definitions

- `users`: Core account record storing credentials, detection toggles, tab-closing preferences, AI labeling preference, confidence thresholds, and tour status.
- `auth_sessions`: Active authentication session tokens with 30-day expiration windows and cascade deletion.
- `modes`: User-defined Work Modes including name, description, visual icon, usage counters, and last-used timestamps.
- `mode_links`: Resource records tied to a Work Mode, containing title, destination URL, extracted hostname, and sort position.
- `sessions`: Concrete restored work sessions recording exact start and end timestamps, computed duration in seconds, switch counts, and restoration trigger source (`manual`, `detected`, `restored`).
- `context_signals`: Lightweight telemetry signals (hostname, title hash, URL pattern, cluster key) recorded for engine learning.
- `detection_events`: Complete audit log of suggestions generated by the engine, including candidate mode ID, score, array of reasons, matched hostnames, and user acceptance state.

---

## 7. Application Screens and User Interface

The web interface is organized into dedicated functional views:

- Landing Page (`/`): Product narrative, interactive representation of the five-stage operational loop, signal explanation, and extension download CTA.
- Dashboard Overview (`/dashboard`): Seven-day focus metrics, suggestion acceptance rate, session count, average context switches per session, and quick-launch mode shortcuts.
- Work Modes Board (`/dashboard/modes`): Visual grid of all configured Work Modes. Supports one-click restoration of all links, mode deletion, and new mode creation.
- Mode Detail (`/dashboard/modes/[id]`): Resource management view for an individual mode. Allows adding, reordering, and deleting URLs, editing mode metadata, and reviewing mode statistics.
- Live Detection Simulator (`/dashboard/live`): Browser-based sandbox simulating extension tab telemetry. Includes preconfigured scenarios to test the engine without installing the extension:
  - Mixed Window: Academic project tabs tangled with personal inbox and video streams.
  - Client Window: Freelance client resources across repositories, design files, and deployments.
  - Unrecognised Window: Machine learning research cluster demonstrating discovery mode.
  - Scattered Window: Frequent jumping between unrelated topics triggering switch warnings.
- Detection Log (`/dashboard/detection`): Complete audit history of every suggestion, showing the exact heuristic score, point breakdown reasons, and resolution.
- Session History (`/dashboard/sessions`): Chronological log of focus blocks, tracking real durations and switch count indicators measuring fragmentation.
- Settings Panel (`/dashboard/settings`): Engine configuration toggles, custom confidence threshold adjustments, guided tour replay trigger, and extension build manifests.
- Guided Tour: Interactive step-by-step onboarding walkthrough for new accounts.

---

## 8. Complete API Reference

All application endpoints run under the `/api` route prefix:

### Authentication

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/signup` | POST | Register a new user account with email, name, and password |
| `/api/auth/login` | POST | Authenticate user credentials and issue session cookie |
| `/api/auth/logout` | POST | Invalidate current session token and clear cookie |
| `/api/auth/google` | GET | Initiate Google OAuth 2.0 authorization redirect |
| `/api/auth/google/callback` | GET | Handle OAuth redirect code and establish session |

### Context Detection and Feedback

| Endpoint | Method | Description |
|---|---|---|
| `/api/detect` | POST | Ingests tab telemetry snapshot, clusters signals, executes heuristic scoring, applies cooldown rules, and returns candidate suggestions |
| `/api/detections/[id]/respond` | POST | Records user response (`accepted=true/false`). Supports creating a new Work Mode directly from discovery candidates |

### Work Modes and Resources

| Endpoint | Method | Description |
|---|---|---|
| `/api/modes` | GET | Retrieve all Work Modes belonging to the user, including linked resources |
| `/api/modes` | POST | Create a new Work Mode with title, description, and initial links |
| `/api/modes/[id]` | GET | Fetch details and resources for a single Work Mode |
| `/api/modes/[id]` | PATCH | Update name or description of a Work Mode |
| `/api/modes/[id]` | DELETE | Remove a Work Mode and cascade delete its links |
| `/api/modes/[id]/links` | POST | Append a new resource URL to a Work Mode |
| `/api/modes/[id]/activate` | POST | Restores mode: validates URLs, terminates existing live session, logs context signals, and returns valid tabs to launch |
| `/api/links/[id]` | DELETE | Remove a resource URL from a Work Mode |

### Sessions and System

| Endpoint | Method | Description |
|---|---|---|
| `/api/sessions/live` | GET | Query status of any currently open work session |
| `/api/sessions/live` | POST | Explicitly close active live session and calculate duration |
| `/api/settings` | PATCH | Update user preferences, thresholds, name, or tour state |
| `/api/extension/download` | GET | Dynamically compiles and returns fresh extension zip archive (`?target=firefox` for Gecko build) |
| `/api/health` | GET | Health verification endpoint |

---

## 9. Privacy and Security Model

Duplex is architected around strict privacy boundaries:

- Metadata-Only Observation: The extension inspects only structural metadata: URL hostnames, generic path shapes, filtered title keywords, and timestamps.
- Zero Content Access: Duplex never reads page DOM, form inputs, session tokens, passwords, cookies, or user keystrokes.
- Explicit User Agency: The engine never opens, rearranges, or closes tabs without direct user confirmation.
- Safe Restoration: Closing unrelated tabs during mode restoration is strictly opt-in and defaults to disabled.
- Account Isolation: Database records and detection telemetry are strictly partitioned by authenticated user ID.

---

## 10. Setup and Installation

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database instance
- Modern Chromium browser (Chrome, Edge, Brave, Opera) or Mozilla Firefox
- Python 3 (for running automated integration test suite)

### 1. Web Application Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/being-souL1230/Duplex.git
cd Duplex
npm install
```

Configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DATABASE_URL="postgresql://postgres:yourpassword@127.0.0.1:5432/duplex_db"
APP_URL="http://localhost:3000"

# Optional: Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

Synchronize the database schema:

```bash
npx drizzle-kit push
```

Start the local development server:

```bash
npm run dev
```

The web dashboard is now accessible at `http://localhost:3000`.

### Pre-Seeded Demo Account

Visiting `/login` automatically initializes a fully populated demo account if it does not already exist:

- Email: `demo@duplex.dev`
- Password: `demo1234`

This account includes preconfigured Work Modes, simulated sessions, and detection history. New user registrations start with a completely clean workspace.

### 2. Browser Extension Installation

#### Chromium-Based Browsers (Chrome, Brave, Edge, Opera)

1. Open `chrome://extensions` in your browser.
2. Enable Developer mode via the toggle in the upper-right corner.
3. Click Load unpacked and select the `extension/` directory from this repository.
4. Pin the Duplex extension icon to your browser toolbar.
5. Sign in to the web app at `http://localhost:3000/login`. The extension automatically syncs with your session.

Alternatively, download a compiled archive directly from the web application landing page or `/dashboard/live` via the Download Extension button.

#### Mozilla Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click Load Temporary Add-on.
3. Select `extension/manifest.firefox.json` or download the Firefox-specific archive from:
   `http://localhost:3000/api/extension/download?target=firefox`

---

## 11. Testing and Quality Assurance

Duplex includes an end-to-end integration test suite and strict typecheck validation.

### Automated Smoke Test Suite

The test suite in `tests/extension_smoke_test.py` simulates service worker network traffic and validates 52 distinct assertions against the API contracts:

```bash
# Ensure web server is running on http://localhost:3000
python3 tests/extension_smoke_test.py
```

The test runs deterministically by generating unique Work Modes and hostnames per execution, validating:

- Cookie-based authentication exchange
- State retrieval and mode listing
- Context detection under synthetic tab snapshots
- Suggestion acceptance and mode activation workflows
- Suggestion rejection, cooldown triggering, and suppression verification
- Live session creation, tracking, and closure
- Dynamic zip compilation for both browser targets
- Entity cleanup and cascading deletion

### Static Analysis

Run TypeScript type verification:

```bash
npm run typecheck
```

Run ESLint analysis:

```bash
npm run lint
```

---

## 12. Demonstration Walkthrough

To experience the full Duplex workflow in under 3 minutes:

1. Sign in: Open `http://localhost:3000/login` and authenticate with `demo@duplex.dev` / `demo1234`.
2. Live Simulation: Navigate to the Live Detection page (`/dashboard/live`).
3. Mixed Context Test: Select the "Mixed window" scenario and click Run detection. Observe the 92% confidence match for "College Project" with explicit heuristic justifications.
4. Mode Restoration: Click Switch to this mode. Notice that only the five project resources are queued for restoration, while unrelated inbox and media tabs are filtered out.
5. Inspection: Visit the Detection Log (`/dashboard/detection`) to review the recorded event, score, and matched hostnames.
6. Discovery Mode: Return to Live Detection, select the "Unrecognised window" scenario, and trigger detection. Observe the engine identifying a new research cluster and offering to create a new Work Mode.
7. Cooldown Verification: Click Ignore on a suggestion and re-run detection. The engine suppresses the candidate and reports active cooldown status to prevent user fatigue.
8. Session Metrics: Navigate to Sessions (`/dashboard/sessions`) to inspect real focus duration logs and context switch indicators.

---