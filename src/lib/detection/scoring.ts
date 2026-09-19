import type { Cluster } from "./clustering";
import { hostFamily, titleWords } from "./signals";

export type ScoringMode = {
  id: string;
  name: string;
  links: { title: string; url: string; hostname: string }[];
  useCount: number;
};

export type ScoreBreakdown = {
  score: number;
  reasons: string[];
  matchedHosts: string[];
};

export const WEIGHTS = {
  knownResource: 35,
  repeatedDomain: 20,
  timeProximity: 15,
  titleSimilarity: 15,
  priorSession: 15,
} as const;

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Explainable heuristic score of a cluster against one existing mode.
 * Every added point carries a human readable reason.
 */
export function scoreClusterAgainstMode(
  cluster: Cluster,
  mode: ScoringMode,
  history: Record<string, number>,
): ScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;

  const modeHosts = new Set(mode.links.map((l) => l.hostname));
  const modeFamilies = new Set(mode.links.map((l) => hostFamily(l.hostname)));
  const matchedHosts = cluster.hosts.filter((h) => modeHosts.has(h));
  const familyMatches = cluster.hosts.filter(
    (h) => !modeHosts.has(h) && modeFamilies.has(hostFamily(h)),
  );

  if (matchedHosts.length > 0) {
    const points = Math.min(WEIGHTS.knownResource, 18 + matchedHosts.length * 9);
    score += points;
    reasons.push(
      `${matchedHosts.slice(0, 3).join(", ")} already saved in ${mode.name} (+${points})`,
    );
  }

  if (familyMatches.length > 0) {
    score += 8;
    reasons.push(`Related host family ${familyMatches[0]} (+8)`);
  }

  const repeated = cluster.hosts.filter((h) => (history[h] ?? 0) >= 3);
  if (repeated.length > 0) {
    score += WEIGHTS.repeatedDomain;
    reasons.push(`${repeated.slice(0, 2).join(", ")} seen repeatedly before (+20)`);
  }

  if (cluster.signals.length >= 2 && cluster.spanSeconds <= 240) {
    score += WEIGHTS.timeProximity;
    reasons.push(`${cluster.signals.length} tabs opened within a short window (+15)`);
  }

  const modeWords = new Set(mode.links.flatMap((l) => titleWords(l.title)));
  for (const w of titleWords(mode.name)) modeWords.add(w);
  const shared = cluster.words.filter((w) => modeWords.has(w));
  if (shared.length > 0) {
    const points = Math.min(WEIGHTS.titleSimilarity, shared.length * 6);
    score += points;
    reasons.push(`Title keywords match: ${shared.slice(0, 3).join(", ")} (+${points})`);
  }

  // A single shared host is not enough to claim the cluster was seen before.
  if (mode.useCount >= 2 && matchedHosts.length >= 2) {
    score += WEIGHTS.priorSession;
    reasons.push(`This cluster appeared in ${mode.useCount} previous sessions (+15)`);
  }

  return { score: clamp(Math.round(score)), reasons, matchedHosts };
}

/** Score for a cluster that matches no mode - is it a recurring, nameable context? */
export function scoreDiscovery(
  cluster: Cluster,
  history: Record<string, number>,
): ScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;

  if (cluster.signals.length >= 3) {
    score += 25;
    reasons.push(`${cluster.signals.length} related resources open together (+25)`);
  } else if (cluster.signals.length === 2) {
    score += 12;
    reasons.push("2 related resources open together (+12)");
  }

  const repeats = cluster.hosts.map((h) => history[h] ?? 0);
  const seen = Math.min(...(repeats.length ? repeats : [0]));
  if (seen >= 3) {
    score += 35;
    reasons.push(`This cluster appeared in ${seen} earlier sessions (+35)`);
  } else if (seen >= 1) {
    score += 18;
    reasons.push(`Parts of this cluster were seen ${seen}x before (+18)`);
  }

  if (cluster.spanSeconds <= 240 && cluster.signals.length >= 2) {
    score += 15;
    reasons.push("Opened inside the same short window (+15)");
  }

  if (cluster.words.length >= 4) {
    score += 10;
    reasons.push("Titles share a consistent vocabulary (+10)");
  }

  return { score: clamp(Math.round(score)), reasons, matchedHosts: [] };
}
