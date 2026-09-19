import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  detectionEvents,
  modeLinks,
  modes,
  sessions,
  type Mode,
  type ModeLink,
} from "@/db/schema";

export type ModeWithLinks = Mode & { links: ModeLink[] };

export async function getModesWithLinks(userId: string): Promise<ModeWithLinks[]> {
  const rows = await db
    .select()
    .from(modes)
    .where(eq(modes.userId, userId))
    .orderBy(desc(modes.lastUsedAt), desc(modes.createdAt));
  if (rows.length === 0) return [];

  const links = await db
    .select()
    .from(modeLinks)
    .where(
      inArray(
        modeLinks.modeId,
        rows.map((m) => m.id),
      ),
    )
    .orderBy(modeLinks.position, modeLinks.createdAt);

  return rows.map((mode) => ({
    ...mode,
    links: links.filter((l) => l.modeId === mode.id),
  }));
}

export async function getModeWithLinks(
  userId: string,
  modeId: string,
): Promise<ModeWithLinks | null> {
  const [mode] = await db
    .select()
    .from(modes)
    .where(and(eq(modes.id, modeId), eq(modes.userId, userId)))
    .limit(1);
  if (!mode) return null;
  const links = await db
    .select()
    .from(modeLinks)
    .where(eq(modeLinks.modeId, mode.id))
    .orderBy(modeLinks.position, modeLinks.createdAt);
  return { ...mode, links };
}

export type SessionRow = {
  id: string;
  modeId: string | null;
  modeName: string | null;
  modeIcon: string | null;
  startedAt: Date;
  durationSeconds: number;
  switchCount: number;
  source: string;
};

export async function getSessions(userId: string, limit = 20): Promise<SessionRow[]> {
  const rows = await db
    .select({
      id: sessions.id,
      modeId: sessions.modeId,
      modeName: modes.name,
      modeIcon: modes.icon,
      startedAt: sessions.startedAt,
      durationSeconds: sessions.durationSeconds,
      switchCount: sessions.switchCount,
      source: sessions.source,
    })
    .from(sessions)
    .leftJoin(modes, eq(modes.id, sessions.modeId))
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.startedAt))
    .limit(limit);
  return rows;
}

export type DetectionRow = {
  id: string;
  label: string;
  kind: string;
  score: string;
  reasons: string[];
  hostnames: string[];
  accepted: boolean | null;
  createdAt: Date;
  modeId: string | null;
};

export async function getDetections(userId: string, limit = 20): Promise<DetectionRow[]> {
  return db
    .select({
      id: detectionEvents.id,
      label: detectionEvents.label,
      kind: detectionEvents.kind,
      score: detectionEvents.score,
      reasons: detectionEvents.reasons,
      hostnames: detectionEvents.hostnames,
      accepted: detectionEvents.accepted,
      createdAt: detectionEvents.createdAt,
      modeId: detectionEvents.candidateModeId,
    })
    .from(detectionEvents)
    .where(eq(detectionEvents.userId, userId))
    .orderBy(desc(detectionEvents.createdAt))
    .limit(limit);
}

export type Overview = {
  modeCount: number;
  resourceCount: number;
  focusMinutes7d: number;
  sessionCount7d: number;
  avgSwitches: number;
  detectionTotal: number;
  detectionAccepted: number;
  acceptRate: number;
};

export async function getOverview(userId: string): Promise<Overview> {
  const [modeAgg] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(modes)
    .where(eq(modes.userId, userId));

  const [linkAgg] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(modeLinks)
    .innerJoin(modes, eq(modes.id, modeLinks.modeId))
    .where(eq(modes.userId, userId));

  const [sessionAgg] = await db
    .select({
      count: sql<number>`cast(count(*) as int)`,
      seconds: sql<number>`cast(coalesce(sum(${sessions.durationSeconds}), 0) as int)`,
      switches: sql<number>`cast(coalesce(avg(${sessions.switchCount}), 0) as float)`,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        sql`${sessions.startedAt} > now() - interval '7 days'`,
      ),
    );

  const [detectionAgg] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      accepted: sql<number>`cast(count(*) filter (where ${detectionEvents.accepted} is true) as int)`,
    })
    .from(detectionEvents)
    .where(eq(detectionEvents.userId, userId));

  const total = Number(detectionAgg?.total ?? 0);
  const accepted = Number(detectionAgg?.accepted ?? 0);

  return {
    modeCount: Number(modeAgg?.count ?? 0),
    resourceCount: Number(linkAgg?.count ?? 0),
    focusMinutes7d: Math.round(Number(sessionAgg?.seconds ?? 0) / 60),
    sessionCount7d: Number(sessionAgg?.count ?? 0),
    avgSwitches: Math.round(Number(sessionAgg?.switches ?? 0) * 10) / 10,
    detectionTotal: total,
    detectionAccepted: accepted,
    acceptRate: total ? Math.round((accepted / total) * 100) : 0,
  };
}
