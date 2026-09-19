import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  detectionEnabled: boolean("detection_enabled").notNull().default(true),
  closeUnrelatedTabs: boolean("close_unrelated_tabs").notNull().default(false),
  aiLabelsEnabled: boolean("ai_labels_enabled").notNull().default(true),
  highThreshold: integer("high_threshold").notNull().default(70),
  mediumThreshold: integer("medium_threshold").notNull().default(45),
  tourCompleted: boolean("tour_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Work modes                                                          */
/* ------------------------------------------------------------------ */

export const modes = pgTable(
  "modes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon").notNull().default("◍"),
    tone: text("tone").notNull().default("mono"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    useCount: integer("use_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("modes_user_idx").on(t.userId)],
);

export const modeLinks = pgTable(
  "mode_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modeId: uuid("mode_id")
      .notNull()
      .references(() => modes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    hostname: text("hostname").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mode_links_mode_idx").on(t.modeId)],
);

/* ------------------------------------------------------------------ */
/* Sessions / signals / detection                                      */
/* ------------------------------------------------------------------ */

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modeId: uuid("mode_id").references(() => modes.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    switchCount: integer("switch_count").notNull().default(0),
    source: text("source").notNull().default("manual"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const contextSignals = pgTable(
  "context_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    hostname: text("hostname").notNull(),
    titleHash: text("title_hash"),
    urlPattern: text("url_pattern"),
    clusterKey: text("cluster_key"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("context_signals_user_idx").on(t.userId)],
);

export const detectionEvents = pgTable(
  "detection_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateModeId: uuid("candidate_mode_id").references(() => modes.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    kind: text("kind").notNull().default("match"),
    score: numeric("score").notNull().default("0"),
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    hostnames: jsonb("hostnames").$type<string[]>().notNull().default([]),
    accepted: boolean("accepted"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("detection_events_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Mode = typeof modes.$inferSelect;
export type ModeLink = typeof modeLinks.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type DetectionEvent = typeof detectionEvents.$inferSelect;
