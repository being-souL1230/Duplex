import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { modeLinks, modes } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function ownedLinkIds(userId: string, linkId: string) {
  return db
    .select({ id: modeLinks.id })
    .from(modeLinks)
    .innerJoin(modes, eq(modes.id, modeLinks.modeId))
    .where(and(eq(modeLinks.id, linkId), eq(modes.userId, userId)))
    .limit(1);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const owned = await ownedLinkIds(user.id, id);
  if (owned.length === 0) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as { title?: string };
  const [link] = await db
    .update(modeLinks)
    .set({ title: body.title?.trim() || "Untitled" })
    .where(eq(modeLinks.id, id))
    .returning();
  return Response.json({ link });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const owned = await ownedLinkIds(user.id, id);
  if (owned.length === 0) return Response.json({ error: "Not found" }, { status: 404 });

  await db.delete(modeLinks).where(
    inArray(
      modeLinks.id,
      owned.map((o) => o.id),
    ),
  );
  return Response.json({ ok: true });
}
