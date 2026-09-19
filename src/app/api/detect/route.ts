import { db } from "@/db";
import { contextSignals, detectionEvents } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { hostnameHistory } from "@/db/seed";
import { detectFromTabs, type DetectionResult } from "@/lib/detection/detector";
import { formatRetry, isSuppressed, recentIgnores } from "@/lib/detection/cooldown";
import { toSignals, type RawTab } from "@/lib/detection/signals";
import { getModesWithLinks } from "@/lib/queries";

export const dynamic = "force-dynamic";

type IncomingTab = {
  tabId?: number;
  title?: string;
  url?: string;
  secondsAgo?: number;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  if (!user.detectionEnabled) {
    return Response.json({ disabled: true, result: null, eventId: null });
  }

  const body = (await request.json()) as {
    tabs?: IncomingTab[];
    persist?: boolean;
    force?: boolean;
  };
  const now = Date.now();
  const tabs: RawTab[] = (body.tabs ?? [])
    .filter((t) => typeof t.url === "string" && t.url.length > 3)
    .map((t, i) => ({
      tabId: t.tabId ?? i + 1,
      url: t.url as string,
      title: t.title ?? "",
      openedAt: now - (t.secondsAgo ?? 0) * 1000,
    }));

  if (tabs.length === 0) {
    return Response.json({ error: "No tabs supplied" }, { status: 400 });
  }

  const [modeRows, history, ignores] = await Promise.all([
    getModesWithLinks(user.id),
    hostnameHistory(user.id),
    recentIgnores(user.id),
  ]);

  let result: DetectionResult = detectFromTabs(
    tabs,
    modeRows.map((m) => ({
      id: m.id,
      name: m.name,
      useCount: m.useCount,
      links: m.links.map((l) => ({ title: l.title, url: l.url, hostname: l.hostname })),
    })),
    history,
    { high: user.highThreshold, medium: user.mediumThreshold },
  );

  /* Cooldown: don't re-suggest a cluster the user just ignored, unless explicitly
   * forced via manual detection. If the top candidate is cooling down, promote the best
   * clean alternative instead. */
  const candidate = result.candidate;
  const check =
    candidate && !body.force
      ? isSuppressed(candidate, ignores)
      : { suppressed: false, retryAfterMs: 0 };
  let suppressedInfo: { label: string; retryAfter: string } | null = null;

  if (candidate && check.suppressed) {
    suppressedInfo = { label: candidate.label, retryAfter: formatRetry(check.retryAfterMs) };
    const alternative = result.alternatives.find((a) => !isSuppressed(a, ignores).suppressed);
    result = { ...result, candidate: alternative ?? null };
  }

  const signals = toSignals(tabs);
  await db.insert(contextSignals).values(
    signals.map((s) => ({
      userId: user.id,
      hostname: s.hostname,
      titleHash: s.titleHash,
      urlPattern: s.urlPattern,
      clusterKey: result.candidate?.label ?? null,
    })),
  );

  let eventId: string | null = null;
  if (result.candidate && result.candidate.confidence !== "low" && !suppressedInfo) {
    const [event] = await db
      .insert(detectionEvents)
      .values({
        userId: user.id,
        candidateModeId: result.candidate.modeId,
        label: result.candidate.label,
        kind: result.candidate.kind,
        score: String(result.candidate.score),
        reasons: result.candidate.reasons,
        hostnames: result.candidate.hostnames,
        accepted: null,
      })
      .returning({ id: detectionEvents.id });
    eventId = event.id;
  }

  return Response.json({
    result,
    eventId,
    disabled: false,
    suppressed: suppressedInfo,
  });
}
