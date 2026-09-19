import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { detectionEvents } from "@/db/schema";

/**
 * Cooldown — doc test matrix: "User clicks Ignore → Suppress repeated
 * immediate suggestion". When a cluster is ignored we stop re-proposing
 * it for a while so the product never nags.
 */

const WINDOW_MINUTES = 60;
const COOLDOWN_MINUTES = 45;
const MAX_TRACKED = 40;

export type CooldownEntry = {
  /** sorted hostnames of the ignored cluster */
  hostnames: string[];
  /** mode the suggestion pointed at (null = discovery) */
  modeId: string | null;
  ignoredAt: Date;
};

export function cooldownMs(): number {
  return COOLDOWN_MINUTES * 60 * 1000;
}

/** Recent ignored detections for a user (last hour, capped). */
export async function recentIgnores(userId: string): Promise<CooldownEntry[]> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const rows = await db
    .select({
      hostnames: detectionEvents.hostnames,
      modeId: detectionEvents.candidateModeId,
      createdAt: detectionEvents.createdAt,
    })
    .from(detectionEvents)
    .where(and(eq(detectionEvents.userId, userId), eq(detectionEvents.accepted, false)))
    .orderBy(desc(detectionEvents.createdAt))
    .limit(MAX_TRACKED);

  return rows
    .filter((r) => r.createdAt >= since)
    .map((r) => ({
      hostnames: Array.isArray(r.hostnames) ? r.hostnames : [],
      modeId: r.modeId,
      ignoredAt: r.createdAt,
    }));
}

function overlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((h) => setB.has(h)).length;
}

/**
 * Should this candidate be suppressed? Two matching rules:
 *  1. mode-level: same mode ignored recently -> cooldown
 *  2. cluster-level: >=2 shared hostnames with a recently ignored cluster
 *     (covers discovery candidates that have no mode yet)
 */
export function isSuppressed(
  candidate: { modeId: string | null; hostnames: string[] },
  ignores: CooldownEntry[],
  now = Date.now(),
): { suppressed: boolean; retryAfterMs: number } {
  for (const entry of ignores) {
    const remainingMs = entry.ignoredAt.getTime() + cooldownMs() - now;
    if (remainingMs <= 0) continue;

    if (candidate.modeId && entry.modeId === candidate.modeId) {
      return { suppressed: true, retryAfterMs: remainingMs };
    }
    if (overlap(candidate.hostnames, entry.hostnames) >= 2) {
      return { suppressed: true, retryAfterMs: remainingMs };
    }
  }
  return { suppressed: false, retryAfterMs: 0 };
}

export function formatRetry(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  return `${mins} min`;
}
