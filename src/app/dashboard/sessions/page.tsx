import { redirect } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { Ring } from "@/components/Ring";
import { getCurrentUser } from "@/lib/auth";
import { duration, relativeTime } from "@/lib/format";
import { getOverview, getSessions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [sessions, overview] = await Promise.all([
    getSessions(user.id, 40),
    getOverview(user.id),
  ]);

  const longest = sessions.reduce((max, s) => Math.max(max, s.durationSeconds), 0);
  const focusHours = Math.round((overview.focusMinutes7d / 60) * 10) / 10;

  return (
    <>
      <PageHead
        eyebrow="History"
        title="Sessions"
        subtitle="Each restore opens a session. Switch counts show how fragmented that block of work really was."
      />

      <section className="capsule mb-7 flex flex-wrap items-center justify-around gap-6 p-7">
        <Ring value={Math.min(100, focusHours * 8)} size={112} label={`${focusHours}`} suffix="h" caption="last 7 days" />
        <Ring
          value={Math.min(100, (longest / 3600) * 40)}
          size={112}
          label={duration(longest)}
          caption="longest block"
          muted
        />
        <Ring
          value={Math.min(100, overview.avgSwitches * 10)}
          size={112}
          label={String(overview.avgSwitches)}
          caption="avg switches"
          muted
        />
        <div className="max-w-[16rem] text-xs leading-relaxed text-muted">
          A session with many switches is the signal FocusFlow was built to kill. Fewer
          jumps, longer blocks, same work.
        </div>
      </section>

      {sessions.length === 0 ? (
        <div className="capsule flex flex-col items-center py-14 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/12 text-white/25">
            ◌
          </span>
          <p className="mt-5 text-sm tracking-tight">No sessions yet</p>
          <p className="mt-1.5 max-w-xs text-xs text-muted">
            Switch into a mode and the session starts recording itself.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="pill flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs text-muted">
                {s.modeIcon ?? "◌"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{s.modeName ?? "Unassigned window"}</span>
                <span className="mono block text-[0.65rem] text-muted">
                  {s.source} · {relativeTime(s.startedAt)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {Array.from({ length: Math.min(8, s.switchCount) }).map((_, i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/25" />
                ))}
                {s.switchCount === 0 ? (
                  <span className="mono text-[0.6rem] text-muted">no switches</span>
                ) : null}
              </span>
              <span className="mono w-16 shrink-0 text-right text-[0.7rem]">
                {s.durationSeconds > 0 ? duration(s.durationSeconds) : "live"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
