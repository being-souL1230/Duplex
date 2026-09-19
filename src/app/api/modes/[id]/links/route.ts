import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { modeLinks, modes } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { normalizeHostname } from "@/lib/detection/signals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const [mode] = await db
    .select({ id: modes.id })
    .from(modes)
    .where(and(eq(modes.id, id), eq(modes.userId, user.id)))
    .limit(1);
  if (!mode) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as { title?: string; url?: string };
  const url = normalizeUrl(body.url ?? "");
  if (!url) return Response.json({ error: "Enter a valid URL" }, { status: 400 });

  const [{ max }] = await db
    .select({ max: sql<number>`cast(coalesce(max(${modeLinks.position}), -1) as int)` })
    .from(modeLinks)
    .where(eq(modeLinks.modeId, mode.id));

  const [link] = await db
    .insert(modeLinks)
    .values({
      modeId: mode.id,
      title: body.title?.trim() || normalizeHostname(url),
      url,
      hostname: normalizeHostname(url),
      position: Number(max) + 1,
    })
    .returning();

  return Response.json({ link }, { status: 201 });
}
