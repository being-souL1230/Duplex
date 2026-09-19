import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";

/** Sessions that never got an endedAt are treated as dead after this long. */
export const MAX_SESSION_SECONDS = 4 * 60 * 60;

/**
 * Close any sessions for the user that are still "live" (endedAt is null),
 * computing a real duration from startedAt -> now (capped).
 * Returns the number of sessions closed.
 */
export async function closeLiveSessions(
  userId: string,
  options: { endedAt?: Date } = {},
): Promise<number> {
  const live = await db
    .select({ id: sessions.id, startedAt: sessions.startedAt })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.endedAt)));

  if (live.length === 0) return 0;

  const endedAt = options.endedAt ?? new Date();
  let closed = 0;

  for (const s of live) {
    const elapsedSeconds = Math.round((endedAt.getTime() - s.startedAt.getTime()) / 1000);
    const duration = Math.max(
      0,
      Math.min(MAX_SESSION_SECONDS, elapsedSeconds),
    );
    await db
      .update(sessions)
      .set({ endedAt, durationSeconds: duration })
      .where(eq(sessions.id, s.id));
    closed += 1;
  }

  return closed;
}

/** Get the current live session for a user, if any. */
export async function getLiveSession(userId: string) {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.endedAt)))
    .limit(1);
  return row ?? null;
}
