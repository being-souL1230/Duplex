"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Ring } from "@/components/Ring";
import { Triangle } from "@/components/Shapes";
import { shortUrl } from "@/lib/format";
import { SCENARIOS, type SimTab } from "@/lib/scenarios";
import type { ModeDTO } from "@/lib/types";
import type { DetectionResult } from "@/lib/detection/detector";

type Phase = "idle" | "scanning" | "result" | "restored";

export function LiveConsole({
  modes,
  detectionEnabled,
}: {
  modes: ModeDTO[];
  detectionEnabled: boolean;
}) {
  const router = useRouter();
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [tabs, setTabs] = useState<SimTab[]>(SCENARIOS[0].tabs);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [restored, setRestored] = useState<{ title: string; url: string }[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const candidate = result?.candidate ?? null;
  const detectedIds = useMemo(() => new Set(candidate?.tabIds ?? []), [candidate]);

  function pickScenario(id: string) {
    const scenario = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
    setScenarioId(id);
    setTabs(scenario.tabs);
    setPhase("idle");
    setResult(null);
    setEventId(null);
    setRestored(null);
    setStatus(null);
  }

  async function runDetection() {
    setPhase("scanning");
    setStatus(null);
    setRestored(null);
    const res = await fetch("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs }),
    });
    if (!res.ok) {
      setPhase("idle");
      setStatus("Detection failed — the engine is unreachable");
      return;
    }
    const data = (await res.json()) as {
      result: DetectionResult | null;
      eventId: string | null;
      disabled: boolean;
      suppressed: { label: string; retryAfter: string } | null;
    };
    if (data.disabled) {
      setPhase("idle");
      setStatus("Detection is switched off in settings");
      return;
    }
    if (data.suppressed && !data.result?.candidate) {
      setPhase("idle");
      setStatus(
        `“${data.suppressed.label}” is cooling down — try again in ${data.suppressed.retryAfter}`,
      );
      return;
    }
    setResult(data.result);
    setEventId(data.eventId);
    setNewName(data.result?.candidate?.label ?? "New Context");
    setPhase("result");
    router.refresh();
  }

  async function accept() {
    if (!candidate) return;
    setSaving(true);
    let modeId = candidate.modeId;

    if (eventId) {
      const res = await fetch(`/api/detections/${eventId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted: true,
          createMode: candidate.kind === "discovery",
          name: newName,
          tabs: candidate.tabs,
        }),
      });
      const data = (await res.json()) as { modeId?: string };
      modeId = data.modeId ?? modeId;
    }

    if (modeId) {
      const res = await fetch(`/api/modes/${modeId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "detected" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { opened: { title: string; url: string }[] };
        setRestored(data.opened);
        setTabs(
          data.opened.map((t, i) => ({
            tabId: 900 + i,
            title: t.title,
            url: t.url,
            secondsAgo: 0,
          })),
        );
      }
    }

    setSaving(false);
    setPhase("restored");
    setStatus(
      candidate.kind === "discovery"
        ? `Created “${newName}” and restored its resources`
        : `Switched to ${candidate.label}`,
    );
    router.refresh();
  }

  async function ignore() {
    if (eventId) {
      await fetch(`/api/detections/${eventId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: false }),
      });
    }
    setResult(null);
    setPhase("idle");
    setStatus(`Suggestion ignored — this context stays quiet for 45 min`);
    router.refresh();
  }

  async function saveTabsAsMode() {
    const name = saveName.trim();
    if (!name) {
      setStatus("Name the mode before saving");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/modes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: "Saved from the current window.",
        icon: "◎",
        links: tabs.map((t) => ({ title: t.title, url: t.url })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setStatus("Could not save these tabs");
      return;
    }
    setSaveName("");
    setStatus(`Saved ${tabs.length} tabs as “${name}”`);
    router.refresh();
  }

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      {/* ---------- fake browser window ---------- */}
      <section className="capsule p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label">Browser window</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/30" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => pickScenario(s.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[0.7rem] transition ${
                s.id === scenarioId
                  ? "border-transparent bg-white text-black"
                  : "border-white/10 text-muted hover:text-fg"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[0.7rem] text-muted">{scenario.hint}</p>

        <ul className="mt-5 space-y-2">
          {tabs.map((tab) => {
            const inContext = phase === "result" && detectedIds.has(tab.tabId);
            const dimmed = phase === "result" && !inContext;
            return (
              <li
                key={tab.tabId}
                className={`pill flex items-center gap-3 px-3 py-2.5 transition ${
                  inContext ? "border-white/25 bg-white/[0.06]" : ""
                } ${dimmed ? "opacity-35" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[0.65rem] uppercase ${
                    inContext ? "border-white/40 text-fg" : "border-white/10 text-muted"
                  }`}
                >
                  {inContext ? "✓" : tab.url.replace(/^https?:\/\//, "").charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{tab.title}</span>
                  <span className="mono block truncate text-[0.65rem] text-muted">
                    {shortUrl(tab.url)}
                  </span>
                </span>
                <button
                  onClick={() => setTabs((prev) => prev.filter((t) => t.tabId !== tab.tabId))}
                  className="shrink-0 px-1 text-xs text-muted transition hover:text-fg"
                  aria-label="Close tab"
                >
                  ✕
                </button>
              </li>
            );
          })}
          {tabs.length === 0 ? (
            <li className="py-8 text-center text-xs text-muted">
              Every tab closed. Pick a window above.
            </li>
          ) : null}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            className="field sm:flex-1"
            placeholder="Save this window as a mode…"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveTabsAsMode()}
          />
          <button
            className="btn"
            onClick={saveTabsAsMode}
            disabled={saving || tabs.length === 0}
          >
            Save tabs
          </button>
        </div>
      </section>

      {/* ---------- extension popup ---------- */}
      <section className="capsule flex flex-col p-6">
        <div className="flex items-center justify-between">
          <span className="label">Extension popup</span>
          <span className="flex items-center gap-1.5 text-[0.65rem] text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                detectionEnabled ? "bg-white pulse-dot" : "bg-white/20"
              }`}
            />
            {detectionEnabled ? "observing" : "paused"}
          </span>
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          {phase === "scanning" ? (
            <>
              <div className="relative flex h-[8.5rem] w-[8.5rem] items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-white/10" />
                <span className="absolute inset-0 rounded-full border-t border-white/70 scan" />
                <span className="mono text-[0.65rem] text-muted">clustering</span>
              </div>
              <p className="mt-5 text-xs text-muted">
                Normalising hostnames, grouping by time proximity…
              </p>
            </>
          ) : candidate && phase === "result" ? (
            <div className="flex w-full flex-col items-center rise">
              <Ring
                value={candidate.score}
                size={136}
                label={String(candidate.score)}
                suffix="%"
                caption={candidate.confidence}
                muted={candidate.confidence !== "high"}
              />
              <p className="mt-5 text-[0.7rem] text-muted">
                {candidate.kind === "match" ? "Looks like you're in" : "New context found"}
              </p>
              {candidate.kind === "discovery" ? (
                <input
                  className="field mt-2 text-center"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              ) : (
                <p className="mt-1 text-lg tracking-tight">{candidate.label}</p>
              )}

              <ul className="mt-5 w-full space-y-1.5 text-left">
                {candidate.reasons.slice(0, 3).map((reason) => (
                  <li
                    key={reason}
                    className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-muted"
                  >
                    <Triangle size={7} className="mt-1 shrink-0 text-white/35" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex w-full flex-col gap-2">
                <button className="btn btn-solid w-full" onClick={accept} disabled={saving}>
                  {candidate.kind === "match" ? "Switch to this mode" : "Create this mode"}
                </button>
                <button className="btn btn-quiet w-full" onClick={ignore} disabled={saving}>
                  Not this context
                </button>
              </div>
            </div>
          ) : phase === "restored" && restored ? (
            <div className="flex w-full flex-col items-center rise">
              <div className="flex h-[8.5rem] w-[8.5rem] flex-col items-center justify-center rounded-full border border-white/15">
                <span className="text-xl text-white/70">✓</span>
                <span className="mono mt-1 text-[0.65rem] text-muted">
                  {restored.length} restored
                </span>
              </div>
              <p className="mt-5 max-w-[15rem] text-xs leading-relaxed text-muted">
                Workspace rebuilt. The unrelated tabs were left untouched — closing is
                opt-in.
              </p>
              <button className="btn mt-5 w-full" onClick={() => pickScenario(scenarioId)}>
                Reset window
              </button>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center">
              <div className="relative flex h-[8.5rem] w-[8.5rem] items-center justify-center rounded-full border border-dashed border-white/12">
                <span className="mono text-[0.65rem] text-muted">{tabs.length} tabs</span>
                <span className="absolute inset-[-8%] rounded-full border border-white/[0.05] orbit" />
              </div>
              <p className="mt-5 max-w-[15rem] text-xs leading-relaxed text-muted">
                The engine reads hostname, title words, order and timing — never page
                content.
              </p>
              <button
                className="btn btn-solid mt-5 w-full"
                onClick={runDetection}
                disabled={tabs.length === 0}
              >
                Run detection
              </button>
            </div>
          )}
        </div>

        {result?.switchWarning && phase !== "restored" ? (
          <div className="pill mt-5 flex items-start gap-2 px-4 py-2.5">
            <Triangle size={8} className="mt-1 shrink-0 text-white/50" />
            <p className="text-[0.7rem] leading-relaxed text-muted">
              {result.switchWarning}. Stay with one mode for the next block?
            </p>
          </div>
        ) : null}

        {status ? (
          <p className="mt-4 text-center text-[0.7rem] text-muted rise">{status}</p>
        ) : null}

        <div className="mt-6">
          <span className="label">Saved modes</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {modes.slice(0, 6).map((m) => (
              <span key={m.id} className="pill px-3 py-1.5 text-[0.7rem] text-muted">
                {m.icon} {m.name}
              </span>
            ))}
            {modes.length === 0 ? (
              <span className="text-[0.7rem] text-muted">No modes yet</span>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
