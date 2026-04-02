const { validateEnvSecurity } = require("../src/config/env.validation");

function baseConfig(overrides = {}) {
  return {
    NODE_ENV: "development",
    SESSION_SECRET: "change-me-in-production",
    PROFILE_ENCRYPTION_KEY: "trailforge-local-encryption-key",
    WECHAT_RECON_SECRET: "trailforge-recon-secret",
    DB_PASSWORD: "trailforge",
    ...overrides
  };
}

describe("Environment security validation", () => {
  test("allows local defaults in development", () => {
    expect(() => validateEnvSecurity(baseConfig({ NODE_ENV: "development" }))).not.toThrow();
  });

  test("allows local defaults in test", () => {
    expect(() => validateEnvSecurity(baseConfig({ NODE_ENV: "test" }))).not.toThrow();
  });

  test("rejects placeholder secrets in production", () => {
    expect(() => validateEnvSecurity(baseConfig({ NODE_ENV: "production" }))).toThrow(/Unsafe environment configuration/);
  });

  test("accepts strong non-default secrets in production", () => {
    expect(() =>
      validateEnvSecurity(
        baseConfig({
          NODE_ENV: "production",
          SESSION_SECRET: "prod-session-secret-123456789",
          PROFILE_ENCRYPTION_KEY: "prod-encryption-key-1234567890",
          WECHAT_RECON_SECRET: "prod-recon-secret-123456",
          DB_PASSWORD: "prod-db-password-123"
        })
      )
    ).not.toThrow();
  });
});
