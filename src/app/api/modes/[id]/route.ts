import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { modes } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { getModeWithLinks } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const mode = await getModeWithLinks(user.id, id);
  if (!mode) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ mode });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    icon?: string;
  };

  const [updated] = await db
    .update(modes)
    .set({
      ...(body.name !== undefined ? { name: body.name.trim() || "Untitled" } : {}),
      ...(body.description !== undefined
        ? { description: body.description.trim() || null }
        : {}),
      ...(body.icon !== undefined ? { icon: body.icon.trim() || "◍" } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(modes.id, id), eq(modes.userId, user.id)))
    .returning();

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ mode: updated });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const deleted = await db
    .delete(modes)
    .where(and(eq(modes.id, id), eq(modes.userId, user.id)))
    .returning({ id: modes.id });
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
