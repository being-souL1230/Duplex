import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { exchangeCodeForProfile, googleConfigured, verifyState } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google/callback
 * Verifies state, upserts the user (first Google login creates the row),
 * then starts a FocusFlow session and redirects to the dashboard.
 * Google users get a random unusable password hash — they sign in via Google.
 */
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return Response.redirect(new URL("/login?error=google_unconfigured", request.url), 302);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return Response.redirect(new URL("/login?error=google_failed", request.url), 302);
  }

  /* CSRF check: query-param state must match the cookie we set. */
  const store = await cookies();
  const cookieState = store.get("ff_oauth_state")?.value;
  store.delete("ff_oauth_state");
  if (!cookieState || cookieState !== state || !verifyState(state)) {
    return Response.redirect(new URL("/login?error=google_state", request.url), 302);
  }

  let profile;
  try {
    profile = await exchangeCodeForProfile(code, url.origin);
  } catch {
    return Response.redirect(new URL("/login?error=google_failed", request.url), 302);
  }

  if (!profile.email_verified) {
    return Response.redirect(new URL("/login?error=google_unverified", request.url), 302);
  }

  const email = profile.email.toLowerCase();
  const name = profile.name?.trim() || email.split("@")[0];

  /* Upsert: existing email (password or Google) logs in; new email signs up. */
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        /* 32 random bytes hex — nobody knows it; Google owns this identity. */
        passwordHash: hashPassword(
          Buffer.from(
            `${email}|${profile.sub}|${process.env.GOOGLE_CLIENT_SECRET ?? "x"}`,
          ).toString("base64url"),
        ),
      })
      .returning();
    userId = created.id;
  }

  await createSession(userId);
  return Response.redirect(new URL("/dashboard", request.url), 302);
}
