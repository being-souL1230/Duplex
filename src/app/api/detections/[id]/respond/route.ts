import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { detectionEvents, modeLinks, modes } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { normalizeHostname } from "@/lib/detection/signals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Confirmation step. accepted=false keeps the event so the engine can learn
 * which associations the user rejects.
 */
export async function POST(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const body = (await request.json()) as {
    accepted?: boolean;
    createMode?: boolean;
    name?: string;
    tabs?: { title?: string; url?: string }[];
  };

  const [event] = await db
    .select()
    .from(detectionEvents)
    .where(and(eq(detectionEvents.id, id), eq(detectionEvents.userId, user.id)))
    .limit(1);
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });

  const accepted = body.accepted ?? false;
  await db
    .update(detectionEvents)
    .set({ accepted })
    .where(eq(detectionEvents.id, event.id));

  if (accepted && body.createMode) {
    const [mode] = await db
      .insert(modes)
      .values({
        userId: user.id,
        name: (body.name ?? event.label).trim() || "New Context",
        description: "Discovered automatically from a recurring cluster.",
        icon: "◐",
        lastUsedAt: new Date(),
        useCount: 1,
      })
      .returning();

    const tabs = (body.tabs ?? []).filter((t) => t.url && t.url.length > 3);
    if (tabs.length > 0) {
      await db.insert(modeLinks).values(
        tabs.map((t, index) => ({
          modeId: mode.id,
          title: t.title?.trim() || normalizeHostname(t.url as string),
          url: t.url as string,
          hostname: normalizeHostname(t.url as string),
          position: index,
        })),
      );
    }

    await db
      .update(detectionEvents)
      .set({ candidateModeId: mode.id })
      .where(eq(detectionEvents.id, event.id));

    return Response.json({ ok: true, modeId: mode.id });
  }

  return Response.json({ ok: true, modeId: event.candidateModeId });
}
