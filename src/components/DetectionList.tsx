"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ring } from "@/components/Ring";
import { Triangle } from "@/components/Shapes";
import { relativeTime } from "@/lib/format";

export type DetectionItem = {
  id: string;
  label: string;
  kind: string;
  score: number;
  reasons: string[];
  hostnames: string[];
  accepted: boolean | null;
  createdAt: string;
  modeId: string | null;
};

export function DetectionList({ items }: { items: DetectionItem[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [openId, setOpenId] = useState<string | null>(null);

  async function respond(id: string, accepted: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, accepted } : r)));
    await fetch(`/api/detections/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted }),
    });
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="capsule flex flex-col items-center py-14 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/12 text-white/25">
          ◌
        </span>
        <p className="mt-5 text-sm tracking-tight">No detections yet</p>
        <p className="mt-1.5 max-w-xs text-xs text-muted">
          Open the live view and run the engine against a window to see scored
          suggestions here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const open = openId === row.id;
        return (
          <li key={row.id} className="capsule p-4">
            <div className="flex items-center gap-4">
              <Ring
                value={row.score}
                size={58}
                stroke={1.6}
                label={String(Math.round(row.score))}
                muted={row.accepted !== true}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm tracking-tight">{row.label}</p>
                <p className="mono mt-0.5 truncate text-[0.65rem] text-muted">
                  {row.kind === "discovery" ? "new cluster" : "known mode"} ·{" "}
                  {row.hostnames.slice(0, 3).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.accepted === null ? (
                  <>
                    <button className="btn px-3 py-1.5 text-[0.7rem]" onClick={() => respond(row.id, true)}>
                      Accept
                    </button>
                    <button
                      className="btn btn-quiet px-3 py-1.5 text-[0.7rem]"
                      onClick={() => respond(row.id, false)}
                    >
                      Ignore
                    </button>
                  </>
                ) : (
                  <span className="pill px-3 py-1.5 text-[0.65rem] text-muted">
                    {row.accepted ? "accepted" : "ignored"}
                  </span>
                )}
                <button
                  onClick={() => setOpenId(open ? null : row.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-muted transition hover:text-fg"
                  aria-label="Why this score"
                >
                  <span className={open ? "rotate-180 transition" : "transition"}>
                    <Triangle size={8} />
                  </span>
                </button>
              </div>
            </div>

            {open ? (
              <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4 rise">
                {row.reasons.length === 0 ? (
                  <p className="text-[0.7rem] text-muted">No breakdown stored.</p>
                ) : (
                  row.reasons.map((reason) => (
                    <p
                      key={reason}
                      className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-muted"
                    >
                      <Triangle size={7} className="mt-1 shrink-0 text-white/35" />
                      {reason}
                    </p>
                  ))
                )}
                <p className="label pt-2">{relativeTime(row.createdAt)}</p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
