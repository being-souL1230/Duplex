import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const name = body.name?.trim() || email?.split("@")[0] || "You";

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "Password needs at least 6 characters" }, { status: 400 });
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return Response.json({ error: "That email is already registered" }, { status: 409 });
  }

  /* Clean start: no dummy modes or links for new users.
   * The dashboard's empty states guide them to create their own. */
  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash: hashPassword(password) })
    .returning();

  await createSession(user.id);
  return Response.json({ ok: true });
}
