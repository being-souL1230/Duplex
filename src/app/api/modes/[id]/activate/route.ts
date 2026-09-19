import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contextSignals, modeLinks, modes, sessions } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { titleHash, urlPattern } from "@/lib/detection/signals";
import { closeLiveSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Restore flow: validate resources → open them → record the session. */
export async function POST(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const [mode] = await db
    .select()
    .from(modes)
    .where(and(eq(modes.id, id), eq(modes.userId, user.id)))
    .limit(1);
  if (!mode) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { source?: string };

  /* A new activation ends any previous live session with its real duration. */
  await closeLiveSessions(user.id);

  const links = await db
    .select()
    .from(modeLinks)
    .where(eq(modeLinks.modeId, mode.id))
    .orderBy(modeLinks.position);

  const valid = links.filter((l) => {
    try {
      new URL(l.url);
      return true;
    } catch {
      return false;
    }
  });

  await db
    .update(modes)
    .set({
      lastUsedAt: new Date(),
      useCount: sql`${modes.useCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(modes.id, mode.id));

  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      modeId: mode.id,
      source: body.source === "detected" ? "detected" : "restored",
      durationSeconds: 0,
    })
    .returning();

  if (valid.length > 0) {
    await db.insert(contextSignals).values(
      valid.map((l) => ({
        userId: user.id,
        sessionId: session.id,
        hostname: l.hostname,
        titleHash: titleHash(l.title),
        urlPattern: urlPattern(l.url),
        clusterKey: mode.name,
      })),
    );
  }

  return Response.json({
    session,
    opened: valid.map((l) => ({ title: l.title, url: l.url, hostname: l.hostname })),
    skipped: links.length - valid.length,
  });
}
