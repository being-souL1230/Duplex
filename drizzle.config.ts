import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/*
 * drizzle-kit does not load .env on its own, so parse it minimally here.
 * This keeps credentials out of the repo: the config itself never
 * contains a connection string.
 */
function loadEnvFile() {
  if (process.env.DATABASE_URL) return;
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // No .env file present; rely on the process environment (e.g. Vercel).
  }
}

loadEnvFile();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required (set it in .env or the environment)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url,
  },
});
