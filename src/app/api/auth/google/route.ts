import { randomUUID } from "node:crypto";
import { buildAuthUrl, googleConfigured, signState } from "@/lib/google";

export const dynamic = "force-dynamic";

/** GET /api/auth/google - kick off the OAuth flow. */
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return Response.json(
      { error: "Google sign-in is not configured on this server" },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const state = signState(randomUUID());

  const res = Response.redirect(buildAuthUrl(origin, state), 302);
  /* State also rides a short-lived cookie; callback checks both. */
  const headers = new Headers(res.headers);
  headers.append(
    "Set-Cookie",
    `dx_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
  );
  return new Response(null, { status: 302, headers });
}
