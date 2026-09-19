import { db } from "@/db";
import { modeLinks, modes } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { normalizeHostname } from "@/lib/detection/signals";
import { getModesWithLinks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ modes: await getModesWithLinks(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    icon?: string;
    links?: { title?: string; url?: string }[];
  };

  const name = body.name?.trim();
  if (!name) return Response.json({ error: "Mode name is required" }, { status: 400 });

  const [mode] = await db
    .insert(modes)
    .values({
      userId: user.id,
      name,
      description: body.description?.trim() || null,
      icon: body.icon?.trim() || "◍",
    })
    .returning();

  const links = (body.links ?? [])
    .map((l) => ({ title: l.title?.trim() ?? "", url: l.url?.trim() ?? "" }))
    .filter((l) => l.url.length > 3);

  if (links.length > 0) {
    await db.insert(modeLinks).values(
      links.map((link, index) => ({
        modeId: mode.id,
        title: link.title || normalizeHostname(link.url),
        url: link.url,
        hostname: normalizeHostname(link.url),
        position: index,
      })),
    );
  }

  return Response.json({ mode: { ...mode, links: [] } }, { status: 201 });
}
