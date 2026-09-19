"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { relativeTime } from "@/lib/format";
import { ICONS, type ModeDTO } from "@/lib/types";

/** Tiny arrow-up-right glyph used by the open-links buttons. */
export function OpenIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor">
      <path
        d="M7 17 17 7M9 7h8v8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ModeDisc({ mode }: { mode: ModeDTO }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  /** Open every link of this mode right from the grid. */
  async function openAll() {
    if (opening || mode.links.length === 0) return;
    setOpening(true);
    setStatus(null);

    /* Fire the clicks from the user gesture first so pop-ups are not blocked. */
    let opened = 0;
    let valid = 0;
    for (const link of mode.links) {
      try {
        new URL(link.url);
      } catch {
        continue; /* skip invalid URLs, same rule as the activate route */
      }
      valid += 1;
      const win = window.open(link.url, "_blank", "noopener,noreferrer");
      if (win) opened += 1;
    }

    /* Then record the session server-side (fire and forget).
     * Optimistic cards carry a temp id that is not in the DB yet —
     * skip the session call for those. */
    if (!mode.id.startsWith("temp-")) {
      await fetch(`/api/modes/${mode.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "restored" }),
      }).catch(() => {});
    }

    setOpening(false);
    if (opened === valid) {
      setStatus(`${opened} opened`);
    } else if (opened === 0) {
      setStatus("Pop-ups blocked — allow them for this site");
    } else {
      setStatus(`${opened}/${valid} opened — allow pop-ups for all`);
    }
    router.refresh();
  }

  return (
    <div className="disc group relative flex aspect-square flex-col items-center justify-center gap-1 px-6 text-center">
      {/* quick open — tiny icon circle, top corner, revealed on hover */}
      <button
        onClick={openAll}
        disabled={opening || mode.links.length === 0}
        title="Open all links"
        aria-label="Open all links"
        className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-muted opacity-0 transition hover:border-transparent hover:bg-white hover:text-black focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
      >
        {opening ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
        ) : (
          <OpenIcon />
        )}
      </button>

      <Link
        href={`/dashboard/modes/${mode.id}`}
        className="flex flex-col items-center gap-1"
      >
        <span className="text-lg leading-none text-white/70 transition group-hover:text-white">
          {mode.icon}
        </span>
        <span className="line-clamp-2 text-sm tracking-tight">{mode.name}</span>
      </Link>
      <span className="mono text-[0.65rem] text-muted">
        {mode.links.length} {mode.links.length === 1 ? "link" : "links"}
      </span>
      <span className="label opacity-70">{relativeTime(mode.lastUsedAt)}</span>

      {status ? (
        <span className="mono absolute bottom-3 text-[0.6rem] text-muted">{status}</span>
      ) : null}
    </div>
  );
}

export function ModesBoard({ initialModes }: { initialModes: ModeDTO[] }) {
  const router = useRouter();
  const [modes, setModes] = useState(initialModes);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setError("Give the mode a name");
      return;
    }
    setSaving(true);
    setError(null);

    const links = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url: /^https?:\/\//.test(url) ? url : `https://${url}`, title: "" }));

    const optimistic: ModeDTO = {
      id: `temp-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || null,
      icon,
      useCount: 0,
      lastUsedAt: null,
      links: links.map((l, i) => ({
        id: `temp-${i}`,
        title: l.url,
        url: l.url,
        hostname: l.url,
      })),
    };
    setModes((prev) => [optimistic, ...prev]);
    setOpen(false);
    setName("");
    setDescription("");
    setUrls("");

    const res = await fetch("/api/modes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: optimistic.name, description, icon, links }),
    });

    setSaving(false);
    if (!res.ok) {
      setModes((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError("Could not save the mode");
      return;
    }

    /* Swap the temp id for the real one immediately so the fresh card is
     * safe to click — its old `temp-…` id never existed in the DB. */
    const data = (await res.json()) as { mode?: { id?: string } };
    const realId = data.mode?.id;
    if (realId) {
      setModes((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, id: realId } : m)),
      );
    }
    router.refresh();
  }

  return (
    <div>
      {open ? (
        <div className="capsule mb-8 space-y-3 p-6 rise">
          <div className="flex flex-wrap items-center gap-2">
            {ICONS.map((g) => (
              <button
                key={g}
                onClick={() => setIcon(g)}
                className={`h-9 w-9 rounded-full border text-sm transition ${
                  icon === g
                    ? "border-transparent bg-white text-black"
                    : "border-white/10 text-muted hover:text-fg"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <input
            className="field"
            placeholder="Mode name — e.g. Client Redesign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className="field"
            placeholder="Short description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <textarea
            className="field min-h-24 rounded-[1.75rem] resize-none"
            placeholder={"One URL per line (optional)\ngithub.com/you/repo\nfigma.com/file/…"}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
          />
          {error ? <p className="px-2 text-xs text-muted">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button className="btn btn-quiet" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-solid" onClick={create} disabled={saving}>
              Create mode
            </button>
          </div>
        </div>
      ) : null}

      {modes.length === 0 && !open ? (
        <div className="flex flex-col items-center py-14 text-center">
          <div className="disc flex h-40 w-40 items-center justify-center">
            <span className="text-2xl text-white/25">◌</span>
          </div>
          <p className="mt-6 text-sm tracking-tight">No work modes yet</p>
          <p className="mt-1.5 max-w-xs text-xs text-muted">
            Create one manually, or let detection propose a mode from a recurring
            cluster in the Live view.
          </p>
          <button className="btn btn-solid mt-6" onClick={() => setOpen(true)}>
            New mode
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {modes.map((mode) => (
            <ModeDisc key={mode.id} mode={mode} />
          ))}
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="disc flex aspect-square flex-col items-center justify-center gap-2 border-dashed text-muted hover:text-fg"
            >
              <span className="text-xl leading-none">+</span>
              <span className="text-xs">New mode</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
