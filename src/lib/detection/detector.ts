import { clusterSignals, countContextSwitches, type Cluster } from "./clustering";
import { scoreClusterAgainstMode, scoreDiscovery, type ScoringMode } from "./scoring";
import { toSignals, type RawTab, type TabSignal } from "./signals";

export type Confidence = "high" | "medium" | "low";

export type ContextCandidate = {
  modeId: string | null;
  label: string;
  kind: "match" | "discovery";
  score: number;
  confidence: Confidence;
  reasons: string[];
  hostnames: string[];
  tabIds: number[];
  tabs: { title: string; url: string; hostname: string }[];
};

export type DetectionResult = {
  candidate: ContextCandidate | null;
  alternatives: ContextCandidate[];
  switches: number;
  switchWarning: string | null;
  clusterCount: number;
  observedHostnames: string[];
};

export type Thresholds = { high: number; medium: number };

const ROLE_BY_HOST: Record<string, string> = {
  github: "Code",
  gitlab: "Code",
  localhost: "Local build",
  figma: "Design",
  dribbble: "Design",
  notion: "Notes",
  docs: "Docs",
  google: "Docs",
  stackoverflow: "Research",
  arxiv: "Research",
  youtube: "Video",
  netflix: "Break",
  instagram: "Break",
  x: "Break",
  reddit: "Break",
  mail: "Inbox",
  linear: "Tickets",
  jira: "Tickets",
  vercel: "Deploy",
  upwork: "Client",
  slack: "Team",
};

function titleCase(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Rule-based label used when there is no AI layer (AI is optional by design). */
export function labelForCluster(cluster: Cluster): string {
  const roles = Array.from(
    new Set(
      cluster.signals
        .map((s) => ROLE_BY_HOST[s.host])
        .filter((r): r is string => Boolean(r)),
    ),
  ).slice(0, 2);

  const counts = new Map<string, number>();
  for (const s of cluster.signals) {
    for (const w of s.words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const topWord = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  if (topWord) return `${titleCase(topWord)} Context`;
  if (roles.length >= 2) return `${roles[0]} + ${roles[1]} Context`;
  if (roles.length === 1) return `${roles[0]} Context`;
  const host = cluster.signals[0]?.host ?? "New";
  return `${titleCase(host)} Context`;
}

function confidenceOf(score: number, t: Thresholds): Confidence {
  if (score >= t.high) return "high";
  if (score >= t.medium) return "medium";
  return "low";
}

function toCandidate(
  cluster: Cluster,
  base: { modeId: string | null; label: string; kind: "match" | "discovery" },
  score: number,
  reasons: string[],
  t: Thresholds,
): ContextCandidate {
  return {
    ...base,
    score,
    confidence: confidenceOf(score, t),
    reasons,
    hostnames: cluster.hosts,
    tabIds: cluster.signals.map((s) => s.tabId),
    tabs: cluster.signals.map((s) => ({
      title: s.title,
      url: s.url,
      hostname: s.hostname,
    })),
  };
}

/**
 * Detect → Understand → Confirm. Never mutates anything: it only proposes.
 */
export function detectContext(
  signals: TabSignal[],
  modes: ScoringMode[],
  history: Record<string, number> = {},
  thresholds: Thresholds = { high: 70, medium: 45 },
): DetectionResult {
  const clusters = clusterSignals(signals);
  const candidates: ContextCandidate[] = [];

  for (const cluster of clusters) {
    let best: ContextCandidate | null = null;

    for (const mode of modes) {
      const { score, reasons } = scoreClusterAgainstMode(cluster, mode, history);
      if (score <= 0) continue;
      const candidate = toCandidate(
        cluster,
        { modeId: mode.id, label: mode.name, kind: "match" },
        score,
        reasons,
        thresholds,
      );
      if (!best || candidate.score > best.score) best = candidate;
    }

    // A recurring cluster that no mode explains well can become its own mode.
    const discovery = scoreDiscovery(cluster, history);
    const discoveryCandidate = toCandidate(
      cluster,
      { modeId: null, label: labelForCluster(cluster), kind: "discovery" },
      discovery.score,
      discovery.reasons,
      thresholds,
    );
    if (!best || discoveryCandidate.score > best.score) best = discoveryCandidate;

    if (best) candidates.push(best);
  }

  candidates.sort((a, b) => b.score - a.score);
  const switches = countContextSwitches(signals);
  const switchWarning =
    switches >= 4
      ? `${switches} jumps between unrelated contexts in this window`
      : null;

  return {
    candidate: candidates[0] ?? null,
    alternatives: candidates.slice(1, 4),
    switches,
    switchWarning,
    clusterCount: clusters.length,
    observedHostnames: Array.from(new Set(signals.map((s) => s.hostname))),
  };
}

export function detectFromTabs(
  tabs: RawTab[],
  modes: ScoringMode[],
  history: Record<string, number> = {},
  thresholds: Thresholds = { high: 70, medium: 45 },
): DetectionResult {
  return detectContext(toSignals(tabs), modes, history, thresholds);
}
