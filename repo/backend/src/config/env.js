const path = require("path");
const dotenv = require("dotenv");
const { z } = require("zod");
const { validateEnvSecurity } = require("./env.validation");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default("trailforge"),
  DB_USER: z.string().default("trailforge"),
  DB_PASSWORD: z.string().default("trailforge"),
  SESSION_SECRET: z.string().min(8).default("change-me-in-production"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  PROFILE_ENCRYPTION_KEY: z.string().min(16).default("trailforge-local-encryption-key"),
  WECHAT_RECON_SECRET: z.string().min(8).default("trailforge-recon-secret"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  ORDER_AUTO_CANCEL_MINUTES: z.coerce.number().int().positive().default(30),
  INGESTION_DROP_DIR: z.string().default("./ingestion_drop"),
  INGESTION_SCAN_INTERVAL_MINUTES: z.coerce.number().int().positive().default(1),
  INGESTION_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${details.join("\n")}`);
}

validateEnvSecurity(parsed.data);

module.exports = parsed.data;
