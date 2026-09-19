import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const needsSsl =
  /sslmode=require/.test(databaseUrl) || /\.neon\.tech/.test(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // Managed Postgres providers (Neon) terminate TLS; node-postgres only
    // enables SSL automatically when the URL carries sslmode, and it does
    // not send SNI by default, so configure it explicitly here.
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    // Neon pooler + serverless: recycle aggressively, never hang forever.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
