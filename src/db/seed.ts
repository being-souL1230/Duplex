import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contextSignals,
  detectionEvents,
  modeLinks,
  modes,
  sessions,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { normalizeHostname, titleHash, urlPattern } from "@/lib/detection/signals";

export const DEMO_EMAIL = "demo@duplex.dev";
export const DEMO_PASSWORD = "demo1234";

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

type SeedLink = { title: string; url: string };
type SeedMode = {
  name: string;
  description: string;
  icon: string;
  useCount: number;
  lastUsedHoursAgo: number;
  links: SeedLink[];
};

const SEED_MODES: SeedMode[] = [
  {
    name: "College Project",
    description: "Campus Connect - final year build with the team.",
    icon: "◒",
    useCount: 14,
    lastUsedHoursAgo: 3,
    links: [
      { title: "campus-connect · Issues", url: "https://github.com/team/campus-connect/issues" },
      { title: "Project Report Draft", url: "https://docs.google.com/document/d/report-draft" },
      { title: "Campus Connect UI", url: "https://figma.com/file/campus-connect-ui" },
      { title: "Local build", url: "http://localhost:3000/dashboard" },
      { title: "Sprint Notes", url: "https://notion.so/campus-sprint-notes" },
    ],
  },
  {
    name: "Freelance Client",
    description: "Retainer work for Northwind - invoices, builds, handoff.",
    icon: "◓",
    useCount: 9,
    lastUsedHoursAgo: 26,
    links: [
      { title: "Northwind contract", url: "https://upwork.com/contracts/northwind" },
      { title: "northwind-site · Pull requests", url: "https://github.com/nw/northwind-site/pulls" },
      { title: "Landing revision v4", url: "https://figma.com/file/northwind-landing" },
      { title: "Client inbox", url: "https://mail.google.com/mail/u/0/#label/clients" },
      { title: "Production deploys", url: "https://vercel.com/northwind/site/deployments" },
    ],
  },
  {
    name: "Exam Prep",
    description: "DBMS + Operating Systems revision block.",
    icon: "◑",
    useCount: 6,
    lastUsedHoursAgo: 52,
    links: [
      { title: "Operating Systems lectures", url: "https://youtube.com/playlist?list=os-lectures" },
      { title: "DBMS revision notes", url: "https://notion.so/dbms-revision" },
      { title: "Previous year papers", url: "https://drive.google.com/drive/folders/papers" },
      { title: "Normalization practice", url: "https://geeksforgeeks.org/dbms-normalization" },
    ],
  },
  {
    name: "Hackathon",
    description: "Hack Devengers 2.0 - 24 hour sprint workspace.",
    icon: "◔",
    useCount: 4,
    lastUsedHoursAgo: 8,
    links: [
      { title: "Devengers submission", url: "https://devpost.com/hack-devengers/submission" },
      { title: "duplex · main", url: "https://github.com/duplex/duplex" },
      { title: "Pitch deck", url: "https://docs.google.com/presentation/d/pitch" },
      { title: "Local build", url: "http://localhost:5173/" },
    ],
  },
];

const SEED_SESSIONS: {
  mode: string | null;
  hoursAgo: number;
  minutes: number;
  switches: number;
  source: string;
}[] = [
  { mode: "College Project", hoursAgo: 3, minutes: 82, switches: 2, source: "detected" },
  { mode: "Hackathon", hoursAgo: 8, minutes: 146, switches: 5, source: "restored" },
  { mode: "College Project", hoursAgo: 22, minutes: 54, switches: 3, source: "restored" },
  { mode: "Freelance Client", hoursAgo: 26, minutes: 97, switches: 1, source: "detected" },
  { mode: "Exam Prep", hoursAgo: 52, minutes: 121, switches: 2, source: "manual" },
  { mode: "Freelance Client", hoursAgo: 74, minutes: 63, switches: 6, source: "restored" },
  { mode: "College Project", hoursAgo: 96, minutes: 110, switches: 4, source: "detected" },
  { mode: null, hoursAgo: 120, minutes: 38, switches: 9, source: "manual" },
];

const SEED_DETECTIONS: {
  mode: string | null;
  label: string;
  kind: string;
  score: number;
  accepted: boolean | null;
  hoursAgo: number;
  reasons: string[];
  hostnames: string[];
}[] = [
  {
    mode: "College Project",
    label: "College Project",
    kind: "match",
    score: 92,
    accepted: true,
    hoursAgo: 3,
    reasons: [
      "github.com, docs.google.com already saved in College Project (+35)",
      "4 tabs opened within a short window (+15)",
      "This cluster appeared in 14 previous sessions (+15)",
    ],
    hostnames: ["github.com", "docs.google.com", "figma.com", "localhost"],
  },
  {
    mode: null,
    label: "Research Context",
    kind: "discovery",
    score: 71,
    accepted: null,
    hoursAgo: 11,
    reasons: [
      "3 related resources open together (+25)",
      "This cluster appeared in 3 earlier sessions (+35)",
      "Titles share a consistent vocabulary (+10)",
    ],
    hostnames: ["arxiv.org", "notion.so", "scholar.google.com"],
  },
  {
    mode: "Hackathon",
    label: "Hackathon",
    kind: "match",
    score: 78,
    accepted: true,
    hoursAgo: 9,
    reasons: [
      "github.com, devpost.com already saved in Hackathon (+35)",
      "Title keywords match: duplex, devengers (+12)",
    ],
    hostnames: ["github.com", "devpost.com", "localhost"],
  },
  {
    mode: "Freelance Client",
    label: "Freelance Client",
    kind: "match",
    score: 51,
    accepted: false,
    hoursAgo: 30,
    reasons: [
      "figma.com already saved in Freelance Client (+27)",
      "2 tabs opened within a short window (+15)",
    ],
    hostnames: ["figma.com", "dribbble.com"],
  },
  {
    mode: "Exam Prep",
    label: "Exam Prep",
    kind: "match",
    score: 83,
    accepted: true,
    hoursAgo: 52,
    reasons: [
      "youtube.com, notion.so already saved in Exam Prep (+35)",
      "youtube.com seen repeatedly before (+20)",
      "This cluster appeared in 6 previous sessions (+15)",
    ],
    hostnames: ["youtube.com", "notion.so", "drive.google.com"],
  },
];

const EXTRA_SIGNAL_HOSTS = [
  "arxiv.org",
  "scholar.google.com",
  "notion.so",
  "stackoverflow.com",
  "youtube.com",
  "chat.openai.com",
];

export async function ensureSeeded(): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);
  if (existing.length > 0) return;

  const now = Date.now();
  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      name: "Aarav",
      passwordHash: hashPassword(DEMO_PASSWORD),
    })
    .returning();

  const modeIdByName = new Map<string, string>();

  for (const seedMode of SEED_MODES) {
    const [mode] = await db
      .insert(modes)
      .values({
        userId: user.id,
        name: seedMode.name,
        description: seedMode.description,
        icon: seedMode.icon,
        useCount: seedMode.useCount,
        lastUsedAt: new Date(now - seedMode.lastUsedHoursAgo * HOUR),
      })
      .returning();
    modeIdByName.set(seedMode.name, mode.id);

    await db.insert(modeLinks).values(
      seedMode.links.map((link, index) => ({
        modeId: mode.id,
        title: link.title,
        url: link.url,
        hostname: normalizeHostname(link.url),
        position: index,
      })),
    );
  }

  for (const s of SEED_SESSIONS) {
    const startedAt = new Date(now - s.hoursAgo * HOUR);
    const [session] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        modeId: s.mode ? modeIdByName.get(s.mode) ?? null : null,
        startedAt,
        endedAt: new Date(startedAt.getTime() + s.minutes * 60 * 1000),
        durationSeconds: s.minutes * 60,
        switchCount: s.switches,
        source: s.source,
      })
      .returning();

    const seedMode = SEED_MODES.find((m) => m.name === s.mode);
    const links = seedMode?.links ?? [];
    if (links.length > 0) {
      await db.insert(contextSignals).values(
        links.map((link, i) => ({
          userId: user.id,
          sessionId: session.id,
          hostname: normalizeHostname(link.url),
          titleHash: titleHash(link.title),
          urlPattern: urlPattern(link.url),
          clusterKey: seedMode?.name ?? null,
          observedAt: new Date(startedAt.getTime() + i * 45 * 1000),
        })),
      );
    }
  }

  await db.insert(contextSignals).values(
    EXTRA_SIGNAL_HOSTS.flatMap((hostname, i) =>
      [0, 1, 2, 3].map((k) => ({
        userId: user.id,
        hostname,
        titleHash: null,
        urlPattern: hostname,
        clusterKey: "loose",
        observedAt: new Date(now - (i + 1) * DAY - k * HOUR),
      })),
    ),
  );

  await db.insert(detectionEvents).values(
    SEED_DETECTIONS.map((d) => ({
      userId: user.id,
      candidateModeId: d.mode ? modeIdByName.get(d.mode) ?? null : null,
      label: d.label,
      kind: d.kind,
      score: String(d.score),
      reasons: d.reasons,
      hostnames: d.hostnames,
      accepted: d.accepted,
      createdAt: new Date(now - d.hoursAgo * HOUR),
    })),
  );
}

export async function hostnameHistory(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({
      hostname: contextSignals.hostname,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(contextSignals)
    .where(eq(contextSignals.userId, userId))
    .groupBy(contextSignals.hostname);
  return Object.fromEntries(rows.map((r) => [r.hostname, Number(r.count)]));
}
