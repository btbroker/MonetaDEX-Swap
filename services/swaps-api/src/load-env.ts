/**
 * Load .env before any other code runs.
 * Must be the first import in index.ts so API keys and FEE_RECIPIENT_* are available when adapters are created.
 *
 * Environment-specific files (never commit; see .gitignore):
 * - development: .env then .env.local (local overrides)
 * - staging:     .env then .env.staging
 * - production:  .env then .env.production
 *
 * Base .env is loaded first; then the environment-specific file overrides. When run from monorepo root (e.g. turbo),
 * paths under services/swaps-api/ are tried. Host-set env vars (e.g. in Kubernetes) are not overwritten by dotenv.
 */
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const apiDir = join(__dirname, "..");
const apiDirFromRoot = join(cwd, "services", "swaps-api");

function tryLoad(path: string, override = true): boolean {
  if (existsSync(path)) {
    loadEnv({ path, override });
    return true;
  }
  return false;
}

// Base .env (load first)
const basePaths = [
  join(apiDir, ".env"),
  join(cwd, ".env"),
  join(apiDirFromRoot, ".env"),
];
for (const p of basePaths) {
  if (tryLoad(p, false)) break;
}

// Environment-specific override (dev → .env.local, staging → .env.staging, production → .env.production)
const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();
const envFile =
  nodeEnv === "production"
    ? ".env.production"
    : nodeEnv === "staging"
      ? ".env.staging"
      : ".env.local";

// Dev: .env then .env.local with override:true so .env.local overrides .env
const envPaths = [
  join(apiDir, envFile),
  join(cwd, envFile),
  join(apiDirFromRoot, envFile),
];
for (const p of envPaths) {
  if (tryLoad(p, true)) break;
}

/** True if env var is set and non-empty (trimmed). Use for "required keys" checks; never log the value. */
export function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** True if env var is "true" or "1". Use for flags like REAL_QUOTES_ONLY, DEBUG_QUOTES; never log the value. */
export function envBool(name: string): boolean {
  const v = process.env[name];
  return v === "true" || v === "1";
}
