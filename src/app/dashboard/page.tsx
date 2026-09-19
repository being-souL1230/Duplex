import Link from "next/link";
import { redirect } from "next/navigation";
import { ModeDisc } from "@/components/ModesBoard";
import { PageHead } from "@/components/PageHead";
import { Ring } from "@/components/Ring";
import { Triangle } from "@/components/Shapes";
import { getCurrentUser } from "@/lib/auth";
import { duration, relativeTime } from "@/lib/format";
import { getDetections, getModesWithLinks, getOverview, getSessions } from "@/lib/queries";
import type { ModeDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [overview, modes, sessions, detections] = await Promise.all([
    getOverview(user.id),
    getModesWithLinks(user.id),
    getSessions(user.id, 4),
    getDetections(user.id, 3),
  ]);

  const dto: ModeDTO[] = modes.slice(0, 4).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    icon: m.icon,
    useCount: m.useCount,
    lastUsedAt: m.lastUsedAt ? m.lastUsedAt.toISOString() : null,
    links: m.links.map((l) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      hostname: l.hostname,
    })),
  }));

  const focusHours = Math.round((overview.focusMinutes7d / 60) * 10) / 10;

  return (
    <>
      <PageHead
        eyebrow={`${new Date().toLocaleDateString(undefined, { weekday: "long" })}`}
        title={`Hello, ${user.name}`}
        subtitle="Seven day view of how often Duplex guessed right and what you actually worked on."
        action={
          <Link href="/dashboard/live" className="btn btn-solid">
            <Triangle size={8} className="text-black/70" />
            Open live view
          </Link>
        }
      />

      <section className="capsule grid grid-cols-2 gap-6 p-7 sm:grid-cols-4">
        <div className="flex flex-col items-center gap-3">
          <Ring value={Math.min(100, focusHours * 8)} size={104} label={`${focusHours}`} suffix="h" caption="focus 7d" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <Ring
            value={Math.min(100, overview.sessionCount7d * 12)}
            size={104}
            label={String(overview.sessionCount7d)}
            caption="sessions"
            muted
          />
        </div>
        <div className="flex flex-col items-center gap-3">
          <Ring value={overview.acceptRate} size={104} label={String(overview.acceptRate)} suffix="%" caption="accepted" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <Ring
            value={Math.min(100, overview.avgSwitches * 10)}
            size={104}
            label={String(overview.avgSwitches)}
            caption="avg switches"
            muted
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-sm tracking-tight">Jump back in</h2>
          <Link href="/dashboard/modes" className="label transition hover:text-fg">
            all modes
          </Link>
        </div>
        {dto.length === 0 ? (
          <div className="capsule flex flex-col items-center py-12 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/12 text-white/25">
              ◌
            </span>
            <p className="mt-5 text-sm">No modes yet</p>
            <Link href="/dashboard/modes" className="btn btn-solid mt-5">
              Create the first one
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {dto.map((m) => (
              <ModeDisc key={m.id} mode={m} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="capsule p-6">
          <div className="mb-4 flex items-end justify-between">
            <span className="label">Recent detections</span>
            <Link href="/dashboard/detection" className="label transition hover:text-fg">
              history
            </Link>
          </div>
          <ul className="space-y-2">
            {detections.map((d) => (
              <li key={d.id} className="pill flex items-center gap-3 px-3 py-2.5">
                <Ring value={Number(d.score)} size={40} stroke={1.5} label={String(Math.round(Number(d.score)))} muted={d.accepted !== true} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{d.label}</span>
                  <span className="block truncate text-[0.65rem] text-muted">
                    {d.accepted === true
                      ? "accepted"
                      : d.accepted === false
                        ? "ignored"
                        : "waiting"}{" "}
                    · {relativeTime(d.createdAt)}
                  </span>
                </span>
              </li>
            ))}
            {detections.length === 0 ? (
              <li className="py-6 text-center text-xs text-muted">
                Nothing detected yet - run the live view.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="capsule p-6">
          <div className="mb-4 flex items-end justify-between">
            <span className="label">Recent sessions</span>
            <Link href="/dashboard/sessions" className="label transition hover:text-fg">
              all
            </Link>
          </div>
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="pill flex items-center gap-3 px-3.5 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs text-muted">
                  {s.modeIcon ?? "◌"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">
                  {s.modeName ?? "Unassigned"}
                </span>
                <span className="mono shrink-0 text-[0.65rem] text-muted">
                  {s.durationSeconds > 0 ? duration(s.durationSeconds) : "live"} ·{" "}
                  {relativeTime(s.startedAt)}
                </span>
              </li>
            ))}
            {sessions.length === 0 ? (
              <li className="py-6 text-center text-xs text-muted">No sessions recorded.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </>
  );
}
