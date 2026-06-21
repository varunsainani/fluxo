import "dotenv/config";

type NodeEnv = "development" | "production" | "test";

function read(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : undefined;
}

const NODE_ENV = (read("NODE_ENV") as NodeEnv) || "development";
const isProd = NODE_ENV === "production";

function required(key: string, fallback?: string): string {
  const v = read(key);
  if (v !== undefined) return v;
  if (isProd) {
    throw new Error(`Missing required environment variable in production: ${key}`);
  }
  return fallback ?? "";
}

// Non-secret values can fall back to dev defaults.
const DATABASE_URL = read("DATABASE_URL") ?? "";
const DIRECT_URL = read("DIRECT_URL") ?? DATABASE_URL;

// Secrets: fail-fast in production, dev-only fallback otherwise.
const JWT_ACCESS_SECRET = required("JWT_ACCESS_SECRET", "dev-access-secret-change-me");
const JWT_REFRESH_SECRET = required("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me");
const CRON_SECRET = required("CRON_SECRET", "dev-cron-secret-change-me");
const WEBHOOK_SALT = read("WEBHOOK_SALT") ?? "dev-webhook-salt";

const APP_URL = read("APP_URL") ?? "http://localhost:3000";

// CORS is non-fatal: warn and fall back to APP_URL, never "*".
let CORS_ORIGIN = read("CORS_ORIGIN");
if (!CORS_ORIGIN) {
  // eslint-disable-next-line no-console
  console.warn(
    `[env] CORS_ORIGIN not set; falling back to APP_URL (${APP_URL}). Never use "*" with credentials.`
  );
  CORS_ORIGIN = APP_URL;
}
if (CORS_ORIGIN === "*") {
  // eslint-disable-next-line no-console
  console.warn(`[env] CORS_ORIGIN was "*" which is unsafe with credentials; falling back to APP_URL.`);
  CORS_ORIGIN = APP_URL;
}

const PORT = Number(read("PORT") ?? "4000") || 4000;

export const env = {
  NODE_ENV,
  isProd,
  DATABASE_URL,
  DIRECT_URL,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  CRON_SECRET,
  WEBHOOK_SALT,
  APP_URL,
  CORS_ORIGIN,
  PORT,
};

export type Env = typeof env;
