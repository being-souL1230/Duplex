import { getCurrentUser, unauthorized } from "@/lib/auth";
import { closeLiveSessions, getLiveSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/** Live session status — the extension pings this to decide whether to end. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const live = await getLiveSession(user.id);
  return Response.json({
    live: Boolean(live),
    session: live
      ? {
          id: live.id,
          modeId: live.modeId,
          startedAt: live.startedAt.toISOString(),
        }
      : null,
  });
}

/** Explicitly end the current live session (extension idle / shutdown ping). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const closed = await closeLiveSessions(user.id);
  return Response.json({ ok: true, closed });
}
