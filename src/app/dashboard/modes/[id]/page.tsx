import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ModeDetail } from "@/components/ModeDetail";
import { getCurrentUser } from "@/lib/auth";
import { getModeWithLinks } from "@/lib/queries";
import type { ModeDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** UUIDs only — optimistic UI ids like `temp-…` never reach the database. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const mode = await getModeWithLinks(user.id, id);
  if (!mode) notFound();

  const dto: ModeDTO = {
    id: mode.id,
    name: mode.name,
    description: mode.description,
    icon: mode.icon,
    useCount: mode.useCount,
    lastUsedAt: mode.lastUsedAt ? mode.lastUsedAt.toISOString() : null,
    links: mode.links.map((l) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      hostname: l.hostname,
    })),
  };

  return (
    <>
      <Link
        href="/dashboard/modes"
        className="btn btn-quiet mb-6 px-3 py-1.5 text-xs"
      >
        ← All modes
      </Link>
      <ModeDetail mode={dto} />
    </>
  );
}
