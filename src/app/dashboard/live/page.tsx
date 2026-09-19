import { redirect } from "next/navigation";
import { LiveConsole } from "@/components/LiveConsole";
import { PageHead } from "@/components/PageHead";
import { getCurrentUser } from "@/lib/auth";
import { getModesWithLinks } from "@/lib/queries";
import type { ModeDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LivePage() {
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
        eyebrow="Extension preview"
        title="Live detection"
        subtitle="The same engine the Chrome extension runs, wired to a simulated window so you can see detect → confirm → restore end to end."
        action={
          <a href="/api/extension/download" className="btn" download>
            ↓ Extension .zip
          </a>
        }
      />
      <LiveConsole modes={dto} detectionEnabled={user.detectionEnabled} />
    </>
  );
}
