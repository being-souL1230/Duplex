import { redirect } from "next/navigation";
import { DetectionList, type DetectionItem } from "@/components/DetectionList";
import { PageHead } from "@/components/PageHead";
import { Ring } from "@/components/Ring";
import { getCurrentUser } from "@/lib/auth";
import { getDetections, getOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DetectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [rows, overview] = await Promise.all([
    getDetections(user.id, 30),
    getOverview(user.id),
  ]);

  const items: DetectionItem[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    score: Number(r.score),
    reasons: r.reasons ?? [],
    hostnames: r.hostnames ?? [],
    accepted: r.accepted,
    createdAt: r.createdAt.toISOString(),
    modeId: r.modeId,
  }));

  const pending = items.filter((i) => i.accepted === null).length;

  return (
    <>
      <PageHead
        eyebrow="Engine log"
        title="Detection history"
        subtitle="Every suggestion, its heuristic score and the exact reasons behind it. Nothing here was acted on without a confirmation."
      />

      <section className="capsule mb-7 flex flex-wrap items-center justify-around gap-6 p-7">
        <Ring value={overview.acceptRate} size={112} label={String(overview.acceptRate)} suffix="%" caption="accept rate" />
        <Ring
          value={Math.min(100, overview.detectionTotal * 8)}
          size={112}
          label={String(overview.detectionTotal)}
          caption="suggestions"
          muted
        />
        <Ring
          value={Math.min(100, pending * 25)}
          size={112}
          label={String(pending)}
          caption="waiting"
          muted
        />
        <div className="max-w-[16rem] text-xs leading-relaxed text-muted">
          High confidence earns the right to ask a question — never to act. Ignoring a
          suggestion lowers that association for next time.
        </div>
      </section>

      <DetectionList items={items} />
    </>
  );
}
