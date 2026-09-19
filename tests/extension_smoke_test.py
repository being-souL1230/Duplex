"""
FocusFlow extension integration smoke test.

Simulates the EXACT requests the service worker makes and asserts
that every response field the SW / popup code reads is present.

Deterministic across runs: each run creates a fresh mode on fresh
hostnames so cooldowns from earlier runs never interfere.
Run: python3 tests/extension_smoke_test.py
"""

import json
import random
import subprocess
import sys
import time
import urllib.request

BASE = "http://localhost:3000"
JAR = "/tmp/ff-sw-test.txt"

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    mark = "OK " if cond else "FAIL"
    print(f"  [{mark}] {name}" + (f"  ({detail})" if detail and not cond else ""))


def curl(args, payload=None):
    cmd = ["curl", "-s"] + args
    if payload is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(payload)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    return json.loads(out.stdout) if out.stdout.strip() else None


def main():
    if len(sys.argv) > 1 or not urllib.request.urlopen(BASE, timeout=10):
        pass
    print("\n== 0. Server reachable ==")
    code = urllib.request.urlopen(BASE, timeout=10).status
    check("GET / -> 200", code == 200)

    # ---------- 1. login ----------
    print("\n== 1. Login (extension cookie auth) ==")
    res = curl(["-c", JAR, "-X", "POST", f"{BASE}/api/auth/login"],
               {"email": "demo@focusflow.dev", "password": "demo1234"})
    check("POST /api/auth/login -> ok:true", res and res.get("ok") is True)

    # ---------- 2. GET_STATE -> isLoggedIn + LIST_MODES ----------
    print("\n== 2. GET_STATE / LIST_MODES contract ==")
    with open(JAR) as fh:
        cookie = fh.read()
    check("ff_session cookie set", "ff_session" in cookie)

    res = curl(["-b", JAR, f"{BASE}/api/modes"])
    modes = res.get("modes", []) if res else []
    check("GET /api/modes -> array", isinstance(modes, list))
    check("modes >= 1 (demo seed)", len(modes) >= 1, f"got {len(modes)}")
    if modes:
        m = modes[0]
        for field in ["id", "name", "icon", "useCount", "links"]:
            check(f"mode has '{field}'", field in m)
        check("mode.links is array", isinstance(m.get("links"), list))
        if m.get("links"):
            check("link has 'title'", "title" in m["links"][0])
            check("link has 'url'", "url" in m["links"][0])

    # ---------- 2b. fresh mode on fresh hosts (determinism) ----------
    print("\n== 2b. Fresh mode for this run ==")
    pool = ["stackoverflow.com", "arxiv.org", "geeksforgeeks.org",
            "medium.com", "developer.mozilla.org", "dev.to"]
    host_a, host_b = random.sample(pool, 2)
    run_id = str(int(time.time()))
    mode_name = f"Smoke QA {run_id}"
    res = curl(["-b", JAR, "-X", "POST", f"{BASE}/api/modes"],
               {"name": mode_name,
                "description": "Smoke test mode.",
                "links": [{"title": f"qa {run_id} tracker", "url": f"https://{host_a}/qa/{run_id}"},
                          {"title": f"qa {run_id} notes", "url": f"https://{host_b}/qa/{run_id}"}]})
    qa_mode_id = (res or {}).get("mode", {}).get("id")
    check("fresh QA mode created", bool(qa_mode_id))

    TABS = {"tabs": [
        {"tabId": 1, "title": f"qa {run_id} tracker",
         "url": f"https://{host_a}/qa/{run_id}", "secondsAgo": 200},
        {"tabId": 2, "title": f"qa {run_id} notes",
         "url": f"https://{host_b}/qa/{run_id}", "secondsAgo": 160},
    ]}

    # ---------- 3. DETECT_NOW contract ----------
    print("\n== 3. DETECT_NOW (/api/detect) contract ==")
    res = curl(["-b", JAR, "-X", "POST", f"{BASE}/api/detect"], TABS)
    check("POST /api/detect -> 200 body", res is not None)
    candidate = None
    event_id = None
    if res:
        for field in ["disabled", "result", "eventId", "suppressed"]:
            check(f"response has '{field}'", field in res)
        result = res.get("result") or {}
        candidate = result.get("candidate")
        check("result.candidate present", candidate is not None,
              f"suppressed={res.get('suppressed')}")
        if candidate:
            check("candidate matched fresh mode", candidate.get("label") == mode_name,
                  candidate.get("label"))
            for field in ["kind", "label", "score", "confidence",
                          "reasons", "tabIds", "tabs", "modeId"]:
                check(f"candidate has '{field}'", field in candidate)
            check("confidence is medium/high (badge-worthy)",
                  candidate.get("confidence") in ("medium", "high"),
                  str(candidate.get("confidence")))
            check("reasons is non-empty array",
                  isinstance(candidate.get("reasons"), list) and len(candidate["reasons"]) > 0)
            check("candidate.tabs entries have title/url",
                  all("title" in t and "url" in t for t in candidate.get("tabs", [])))
        check("result has 'switchWarning' key", "switchWarning" in result)
        event_id = res.get("eventId")

    # ---------- 4. ACCEPT contract ----------
    print("\n== 4. ACCEPT (respond + activate) contract ==")
    if event_id and candidate:
        res2 = curl(["-b", JAR, "-X", "POST",
                     f"{BASE}/api/detections/{event_id}/respond"],
                    {"accepted": True,
                     "createMode": candidate.get("kind") == "discovery",
                     "name": candidate.get("label"),
                     "tabs": candidate.get("tabs", [])})
        check("respond -> ok:true", res2 and res2.get("ok") is True)
        mode_id = (res2 or {}).get("modeId") or candidate.get("modeId")
        check("respond returns modeId", bool(mode_id))

        res3 = curl(["-b", JAR, "-X", "POST",
                     f"{BASE}/api/modes/{mode_id}/activate"], {"source": "detected"})
        check("activate -> 200", res3 is not None)
        if res3:
            check("activate has 'opened'", "opened" in res3)
            check("activate has 'session'", "session" in res3)
            check("opened entries have url (tabs.create needs it)",
                  all("url" in o for o in res3.get("opened", [])))
            check("session has id (live-session tracking)",
                  "id" in (res3.get("session") or {}))
    else:
        check("skip accept test (no eventId/candidate)", True)

    # ---------- 5. IGNORE + cooldown contract ----------
    print("\n== 5. IGNORE + cooldown contract ==")
    res = curl(["-b", JAR, "-X", "POST", f"{BASE}/api/detect"], TABS)
    event_id2 = (res or {}).get("eventId")
    if event_id2:
        res2 = curl(["-b", JAR, "-X", "POST",
                     f"{BASE}/api/detections/{event_id2}/respond"],
                    {"accepted": False})
        check("ignore respond -> ok:true", res2 and res2.get("ok") is True)

        res3 = curl(["-b", JAR, "-X", "POST", f"{BASE}/api/detect"], TABS)
        sup = (res3 or {}).get("suppressed")
        check("re-detect after ignore -> suppressed info", sup is not None,
              json.dumps(res3)[:120])
        if sup:
            check("suppressed has 'label'", "label" in sup)
            check("suppressed has 'retryAfter'", "retryAfter" in sup)
            check("no new eventId while suppressed", res3.get("eventId") is None)
    else:
        check("skip ignore test (no second event)", True)

    # ---------- 6. SAVE_TABS contract ----------
    print("\n== 6. SAVE_TABS (/api/modes POST) contract ==")
    res = curl(["-b", JAR, "-X", "POST", f"{BASE}/api/modes"],
               {"name": f"Extension Save {run_id}",
                "description": "Saved from the FocusFlow extension.",
                "links": [{"title": "Example", "url": "https://example.com/article"}]})
    check("POST /api/modes -> 201 mode", res and "mode" in (res or {}))
    saved_mode_id = (res or {}).get("mode", {}).get("id")

    # ---------- 7. Session lifecycle contract ----------
    print("\n== 7. Session lifecycle (GET/POST /api/sessions/live) ==")
    res = curl(["-b", JAR, f"{BASE}/api/sessions/live"])
    check("GET live -> has 'live' flag", res and "live" in res)
    if res and res.get("live"):
        check("live.session has id + startedAt",
              "id" in (res.get("session") or {})
              and "startedAt" in (res.get("session") or {}))
    res = curl(["-b", JAR, "-X", "POST", f"{BASE}/api/sessions/live"])
    check("POST live (end) -> ok:true, closed count",
          res and res.get("ok") is True and "closed" in res)

    # ---------- 8. Download zip ----------
    print("\n== 8. Extension zip download ==")
    out = subprocess.run(["curl", "-s", "-b", JAR, "-o", "/tmp/ff-ext-check.zip",
                          "-w", "%{http_code} %{content_type}",
                          f"{BASE}/api/extension/download"],
                         capture_output=True, text=True, timeout=60)
    code_s, ctype = out.stdout.split()
    check("download -> 200 application/zip",
          code_s == "200" and ctype == "application/zip")

    # ---------- 9. cleanup ----------
    print("\n== 9. Cleanup (also tests DELETE) ==")
    for mid in [qa_mode_id, saved_mode_id]:
        if mid:
            res = curl(["-b", JAR, "-X", "DELETE", f"{BASE}/api/modes/{mid}"])
            check(f"DELETE mode {mid[:8]}… -> ok:true", res and res.get("ok") is True)

    # ---------- summary ----------
    print(f"\n{'=' * 46}")
    print(f"  RESULT: {len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("  Failed checks:")
        for f in FAIL:
            print(f"   - {f}")
    print("=" * 46)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
