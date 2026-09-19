import type { TabSignal } from "./signals";

export type Cluster = {
  key: string;
  signals: TabSignal[];
  hosts: string[];
  words: string[];
  spanSeconds: number;
};

/** Tabs opened inside this window are treated as one working burst. */
export const PROXIMITY_MS = 1000 * 90;

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.filter((w) => set.has(w)).length;
}

/** Two signals belong together if they share a host family, share title words, or arrive together. */
export function related(a: TabSignal, b: TabSignal): boolean {
  if (a.host === b.host) return true;
  if (overlap(a.words, b.words) > 0) return true;
  return Math.abs(a.timestamp - b.timestamp) <= PROXIMITY_MS;
}

/**
 * Connected components over the relatedness graph - deterministic and explainable.
 */
export function clusterSignals(signals: TabSignal[]): Cluster[] {
  const ordered = [...signals].sort((a, b) => a.timestamp - b.timestamp);
  const parent = ordered.map((_, i) => i);

  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let cur = i;
    while (parent[cur] !== cur) {
      const next = parent[cur];
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      if (related(ordered[i], ordered[j])) union(i, j);
    }
  }

  const groups = new Map<number, TabSignal[]>();
  ordered.forEach((signal, i) => {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(signal);
    groups.set(root, list);
  });

  return [...groups.values()]
    .map((group) => {
      const hosts = Array.from(new Set(group.map((s) => s.hostname)));
      const words = Array.from(new Set(group.flatMap((s) => s.words)));
      const times = group.map((s) => s.timestamp);
      return {
        key: clusterKey(hosts),
        signals: group,
        hosts,
        words,
        spanSeconds: Math.round((Math.max(...times) - Math.min(...times)) / 1000),
      };
    })
    .sort((a, b) => b.signals.length - a.signals.length);
}

export function clusterKey(hostnames: string[]): string {
  return Array.from(new Set(hostnames)).sort().slice(0, 6).join("|");
}

/** Counts jumps between unrelated clusters - the "context switching" signal. */
export function countContextSwitches(signals: TabSignal[]): number {
  const ordered = [...signals].sort((a, b) => a.timestamp - b.timestamp);
  let switches = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    if (!related(ordered[i - 1], ordered[i])) switches += 1;
  }
  return switches;
}
