const NON_DEV_ENVS = new Set(["production"]);

const DISALLOWED_DEFAULTS = {
  SESSION_SECRET: ["change-me-in-production", "changeme", "default", "placeholder"],
  PROFILE_ENCRYPTION_KEY: ["trailforge-local-encryption-key", "change-me", "placeholder"],
  WECHAT_RECON_SECRET: ["trailforge-recon-secret", "change-me", "placeholder"],
  DB_PASSWORD: ["trailforge", "password", "changeme", "default"]
};

function validateEnvSecurity(config) {
  if (!NON_DEV_ENVS.has(config.NODE_ENV)) {
    return;
  }

  const violations = [];
  for (const [key, blockedValues] of Object.entries(DISALLOWED_DEFAULTS)) {
    const value = String(config[key] || "").trim().toLowerCase();
    if (!value) {
      violations.push(`${key} is empty`);
      continue;
    }

    if (blockedValues.includes(value)) {
      violations.push(`${key} uses an insecure default value`);
    }
  }

  if (violations.length) {
    throw new Error(
      `Unsafe environment configuration for ${config.NODE_ENV}:\n${violations.join("\n")}\nSet strong, unique secrets via environment variables before startup.`
    );
  }
}

module.exports = {
  validateEnvSecurity,
  DISALLOWED_DEFAULTS
};
