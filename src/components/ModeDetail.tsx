"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ring } from "@/components/Ring";
import { OpenIcon } from "@/components/ModesBoard";
import { Triangle } from "@/components/Shapes";
import { relativeTime, shortUrl } from "@/lib/format";
import { ICONS, type LinkDTO, type ModeDTO } from "@/lib/types";

export function ModeDetail({ mode: initial }: { mode: ModeDTO }) {
  const router = useRouter();
  const [mode, setMode] = useState(initial);
  const [links, setLinks] = useState<LinkDTO[]>(initial.links);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [icon, setIcon] = useState(initial.icon);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [opened, setOpened] = useState<{ title: string; url: string }[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setEditing(false);
    const next = { ...mode, name: name.trim() || mode.name, description, icon };
    setMode(next);
    await fetch(`/api/modes/${mode.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next.name, description, icon }),
    });
    router.refresh();
  }

  async function addLink() {
    const value = url.trim();
    if (!value) return;
    const optimistic: LinkDTO = {
      id: `temp-${Date.now()}`,
      title: title.trim() || value,
      url: value,
      hostname: value.replace(/^https?:\/\//, "").split("/")[0],
    };
    setLinks((prev) => [...prev, optimistic]);
    setUrl("");
    setTitle("");

    const res = await fetch(`/api/modes/${mode.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: value, title: optimistic.title }),
    });

    if (!res.ok) {
      setLinks((prev) => prev.filter((l) => l.id !== optimistic.id));
      setStatus("That URL could not be saved");
      return;
    }
    const data = (await res.json()) as { link: LinkDTO };
    setLinks((prev) => prev.map((l) => (l.id === optimistic.id ? data.link : l)));
    router.refresh();
  }

  async function removeLink(id: string) {
    const snapshot = links;
    setLinks((prev) => prev.filter((l) => l.id !== id));
    const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
    if (!res.ok) setLinks(snapshot);
    else router.refresh();
  }

  /** Open every link in new tabs without switching/creating a session. */
  async function openAllLinks() {
    let opened = 0;
    let valid = 0;
    for (const link of links) {
      try {
        new URL(link.url);
      } catch {
        continue;
      }
      valid += 1;
      const win = window.open(link.url, "_blank", "noopener,noreferrer");
      if (win) opened += 1;
    }
    if (opened === valid && valid > 0) {
      setStatus(`${opened} opened`);
    } else if (opened === 0) {
      setStatus(valid === 0 ? "No valid links to open" : "Pop-ups blocked — allow them for this site");
    } else {
      setStatus(`${opened}/${valid} opened — allow pop-ups for all`);
    }
  }

  async function activate() {
    setBusy(true);
    setStatus(null);
    const res = await fetch(`/api/modes/${mode.id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "restored" }),
    });
    if (!res.ok) {
      setBusy(false);
      setStatus("Restore failed — try again");
      return;
    }
    const data = (await res.json()) as {
      opened: { title: string; url: string }[];
      skipped: number;
    };

    /* Actually open the workspace — first tab focused, rest behind it. */
    let blocked = 0;
    data.opened.forEach((link, i) => {
      const win = window.open(link.url, i === 0 ? "_blank" : "_blank", "noopener,noreferrer");
      if (!win) blocked += 1;
    });

    setBusy(false);
    setOpened(data.opened);
    setMode((m) => ({ ...m, useCount: m.useCount + 1, lastUsedAt: new Date().toISOString() }));
    if (blocked > 0) {
      setStatus("Pop-ups blocked — allow them for this site to open tabs");
    } else {
      setStatus(
        data.skipped > 0
          ? `${data.opened.length} opened · ${data.skipped} invalid skipped`
          : `${data.opened.length} resources opened`,
      );
    }
    router.refresh();
  }

  async function destroy() {
    setBusy(true);
    await fetch(`/api/modes/${mode.id}`, { method: "DELETE" });
    router.push("/dashboard/modes");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="capsule flex flex-col items-center gap-7 p-8 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <Ring value={Math.min(100, mode.useCount * 7)} size={132} caption="uses" label={String(mode.useCount)} />
          <span className="absolute inset-0 flex items-start justify-center pt-5 text-sm text-white/40">
            {mode.icon}
          </span>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          {editing ? (
            <div className="space-y-2.5">
              <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {ICONS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setIcon(g)}
                    className={`h-8 w-8 rounded-full border text-xs transition ${
                      icon === g
                        ? "border-transparent bg-white text-black"
                        : "border-white/10 text-muted hover:text-fg"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
              <input
                className="field"
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex justify-center gap-2 sm:justify-start">
                <button className="btn btn-quiet" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button className="btn btn-solid" onClick={save}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl tracking-[-0.025em]">{mode.name}</h1>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {mode.description || "No description yet."}
              </p>
              <p className="label mt-3">
                {links.length} resources · last used {relativeTime(mode.lastUsedAt)}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <button className="btn btn-solid" onClick={activate} disabled={busy}>
                  <Triangle size={8} className="text-black/70" />
                  Switch to this mode
                </button>
                <button
                  onClick={openAllLinks}
                  disabled={busy || links.length === 0}
                  title="Open all links without switching"
                  className="btn flex items-center gap-2 px-4 py-2"
                >
                  <OpenIcon className="h-3 w-3" />
                  Open links
                </button>
                <button className="btn btn-quiet" onClick={() => setEditing(true)}>
                  Edit
                </button>
                {confirmDelete ? (
                  <>
                    <button className="btn" onClick={destroy} disabled={busy}>
                      Confirm delete
                    </button>
                    <button className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button className="btn btn-quiet" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {status ? (
        <p className="pill mx-auto w-fit px-4 py-1.5 text-xs text-muted rise">{status}</p>
      ) : null}

      {opened ? (
        <section className="capsule p-6 rise">
          <span className="label">Restored window</span>
          <div className="mt-4 flex flex-wrap gap-2">
            {opened.map((t) => (
              <span key={t.url} className="pill px-3.5 py-1.5 text-xs">
                {t.title}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="capsule p-6">
        <div className="flex items-center justify-between">
          <span className="label">Resources</span>
          <span className="mono text-[0.65rem] text-muted">{links.length}</span>
        </div>

        <ul className="mt-4 space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="pill group flex items-center gap-3 px-3 py-2.5 transition hover:border-white/20"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-[0.7rem] uppercase text-muted">
                {link.hostname.replace(/^www\./, "").charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{link.title}</span>
                <span className="mono block truncate text-[0.65rem] text-muted">
                  {shortUrl(link.url)}
                </span>
              </span>
              <button
                onClick={() => removeLink(link.id)}
                className="shrink-0 rounded-full px-2 text-xs text-muted opacity-0 transition hover:text-fg group-hover:opacity-100"
                aria-label="Remove resource"
              >
                ✕
              </button>
            </li>
          ))}
          {links.length === 0 ? (
            <li className="flex flex-col items-center py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-white/12 text-white/25">
                ◌
              </span>
              <p className="mt-4 text-xs text-muted">
                No resources yet — add the first URL below.
              </p>
            </li>
          ) : null}
        </ul>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="field sm:flex-1"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
          />
          <input
            className="field sm:w-44"
            placeholder="Label (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
          />
          <button className="btn" onClick={addLink}>
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
