"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type Settings = {
  name: string;
  detectionEnabled: boolean;
  closeUnrelatedTabs: boolean;
  aiLabelsEnabled: boolean;
  highThreshold: number;
  mediumThreshold: number;
  tourCompleted: boolean;
};

function Toggle({
  on,
  onClick,
  label,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="pill flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs tracking-tight">{label}</p>
        <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted">{hint}</p>
      </div>
      <button
        onClick={onClick}
        aria-pressed={on}
        aria-label={label}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
          on ? "border-transparent bg-white" : "border-white/12 bg-white/[0.04]"
        }`}
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
            on ? "left-6 bg-black" : "left-1 bg-white/40"
          }`}
        />
      </button>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  label,
  hint,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  hint: string;
  min: number;
  max: number;
}) {
  return (
    <div className="pill flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs tracking-tight">{label}</p>
        <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 5))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-muted transition hover:text-fg"
        >
          −
        </button>
        <span className="mono w-9 text-center text-xs">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 5))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-muted transition hover:text-fg"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SettingsPanel({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);

  async function patch(next: Partial<Settings>) {
    const previous = settings;
    const merged = { ...settings, ...next };
    setSettings(merged);
    setStatus("Saved");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      setSettings(previous);
      setStatus("Could not save");
      return;
    }
    router.refresh();
    setTimeout(() => setStatus(null), 1600);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="capsule space-y-2.5 p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Detection</span>
          {status ? <span className="label">{status}</span> : null}
        </div>
        <Toggle
          on={settings.detectionEnabled}
          onClick={() => patch({ detectionEnabled: !settings.detectionEnabled })}
          label="Observe browser context"
          hint="Reads hostname, title words and timing. Never page content."
        />
        <Toggle
          on={settings.closeUnrelatedTabs}
          onClick={() => patch({ closeUnrelatedTabs: !settings.closeUnrelatedTabs })}
          label="Close unrelated tabs on restore"
          hint="Off by default — restoring should never destroy an open context."
        />
        <Toggle
          on={settings.aiLabelsEnabled}
          onClick={() => patch({ aiLabelsEnabled: !settings.aiLabelsEnabled })}
          label="AI naming layer"
          hint="Optional. Rule-based labels are used whenever it is unavailable."
        />
        <Stepper
          value={settings.highThreshold}
          onChange={(n) => patch({ highThreshold: n })}
          label="High confidence threshold"
          hint="Above this score FocusFlow asks you to confirm a switch."
          min={50}
          max={100}
        />
        <Stepper
          value={settings.mediumThreshold}
          onChange={(n) => patch({ mediumThreshold: n })}
          label="Medium confidence threshold"
          hint="Below this the engine stays silent and keeps observing."
          min={20}
          max={80}
        />
      </section>

      <section className="capsule p-6">
        <span className="label">Guided tour</span>
        <div className="pill mt-3 flex items-center gap-4 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-tight">Replay the dashboard tour</p>
            <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted">
              A short walkthrough of every page and what the engine does.
            </p>
          </div>
          <button
            className="btn shrink-0 px-4 py-2 text-[0.7rem]"
            onClick={() => {
              patch({ tourCompleted: false });
              router.refresh();
            }}
          >
            Replay tour
          </button>
        </div>
      </section>

      <section className="capsule p-6">
        <span className="label">Account</span>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="field sm:flex-1"
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            onBlur={() => patch({ name: settings.name })}
          />
          <button className="btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </section>

      <section className="capsule p-6">
        <span className="label">Chrome extension</span>
        <p className="mt-3 max-w-lg text-xs leading-relaxed text-muted">
          Manifest V3, two permissions, no host access. The popup runs the same
          detection engine you see in the live view and syncs modes back here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["manifest_version: 3", "permissions: tabs", "permissions: storage", "no host_permissions"].map(
            (p) => (
              <span key={p} className="pill mono px-3.5 py-1.5 text-[0.65rem] text-muted">
                {p}
              </span>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
