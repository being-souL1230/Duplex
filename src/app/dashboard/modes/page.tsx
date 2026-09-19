import { redirect } from "next/navigation";
import { ModesBoard } from "@/components/ModesBoard";
import { PageHead } from "@/components/PageHead";
import { getCurrentUser } from "@/lib/auth";
import { getModesWithLinks } from "@/lib/queries";
import type { ModeDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ModesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const modes = await getModesWithLinks(user.id);
  const dto: ModeDTO[] = modes.map((m) => ({
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

  return (
    <>
      <PageHead
        eyebrow="Work modes"
        title="Modes"
        subtitle="Each circle is one intention — its resources, its history, its restore point."
      />
      <ModesBoard initialModes={dto} />
    </>
  );
}
