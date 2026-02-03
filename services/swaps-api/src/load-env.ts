/**
 * Load .env before any other code runs.
 * Must be the first import in index.ts so API keys and FEE_RECIPIENT_* are available when adapters are created.
 */
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", ".env") });
