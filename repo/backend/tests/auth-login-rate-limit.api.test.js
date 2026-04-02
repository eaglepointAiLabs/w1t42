const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const bcrypt = require("bcrypt");
const request = require("supertest");
const requestId = require("../src/middleware/request-id");
const errorHandler = require("../src/middleware/error-handler");

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

const writeAuditEventMock = vi.fn(async () => {});

const validPassword = "good-password-123";
const validPasswordHash = bcrypt.hashSync(validPassword, 4);

const connectionMock = {
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(),
  query: vi.fn(async (sql) => {
    if (sql.includes("INSERT INTO auth_sessions")) {
      return [{ insertId: 1001 }];
    }
    if (sql.includes("UPDATE users SET last_login_at")) {
      return [{ affectedRows: 1 }];
    }
    if (sql.includes("SELECT r.code")) {
      return [[{ code: "user" }]];
    }
    if (sql.includes("SELECT id FROM device_fingerprints")) {
      return [[]];
    }
    if (sql.includes("INSERT INTO device_fingerprints")) {
      return [{ insertId: 2001 }];
    }
    if (sql.includes("INSERT INTO user_device_fingerprints")) {
      return [{ affectedRows: 1 }];
    }
    return [[]];
  })
};

const poolMock = {
  query: vi.fn(async (sql, params) => {
    if (sql.includes("FROM users") && sql.includes("WHERE username =")) {
      const username = String(params?.[0] || "");
      if (username === "valid-user") {
        return [[{ id: 10, username: "valid-user", email: "valid@example.local", password_hash: validPasswordHash, status: "active" }]];
      }
      return [[]];
    }
    return [[]];
  }),
  getConnection: vi.fn(async () => connectionMock)
};

function setModuleMock(modulePath, exports) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function buildAuthApp() {
  const app = new Koa();
  app.keys = ["test-secret-key"];
  app.proxy = true;
  app.use(errorHandler);
  app.use(requestId);
  app.use(bodyParser({ enableTypes: ["json"] }));

  const routes = require("../src/modules/auth/auth.routes");
  app.use(routes.routes());
  app.use(routes.allowedMethods());
  return app;
}

describe("Login rate limit middleware", () => {
  const poolModulePath = require.resolve("../src/db/pool");
  const loggerModulePath = require.resolve("../src/logger");
  const auditModulePath = require.resolve("../src/services/audit-log");
  const authRateLimitModulePath = require.resolve("../src/middleware/auth-rate-limit");
  const authRoutesModulePath = require.resolve("../src/modules/auth/auth.routes");

  beforeEach(() => {
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.LOGIN_RATE_LIMIT_MAX_PER_IP = "10";
    process.env.LOGIN_RATE_LIMIT_MAX_PER_IP_USERNAME = "3";

    poolMock.query.mockClear();
    poolMock.getConnection.mockClear();
    connectionMock.beginTransaction.mockClear();
    connectionMock.commit.mockClear();
    connectionMock.rollback.mockClear();
    connectionMock.release.mockClear();
    connectionMock.query.mockClear();
    writeAuditEventMock.mockClear();
    loggerMock.info.mockClear();
    loggerMock.warn.mockClear();
    loggerMock.error.mockClear();

    clearModule(authRoutesModulePath);
    clearModule(authRateLimitModulePath);

    setModuleMock(poolModulePath, { pool: poolMock });
    setModuleMock(loggerModulePath, loggerMock);
    setModuleMock(auditModulePath, { writeAuditEvent: writeAuditEventMock });
  });

  afterAll(() => {
    clearModule(poolModulePath);
    clearModule(loggerModulePath);
    clearModule(auditModulePath);
    clearModule(authRoutesModulePath);
    clearModule(authRateLimitModulePath);
  });

  test("allows normal login under rate limit", async () => {
    const app = buildAuthApp();

    const response = await request(app.callback())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", "203.0.113.10")
      .send({ username: "valid-user", password: validPassword });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.username).toBe("valid-user");
  });

  test("returns 429 after repeated attempts exceed limit", async () => {
    const app = buildAuthApp();

    for (let i = 0; i < 3; i += 1) {
      const attempt = await request(app.callback())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", "203.0.113.20")
        .send({ username: "valid-user", password: "wrong-password" });

      expect(attempt.status).toBe(401);
    }

    const blocked = await request(app.callback())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", "203.0.113.20")
      .send({ username: "valid-user", password: "wrong-password" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error.code).toBe("TOO_MANY_LOGIN_ATTEMPTS");
    expect(blocked.body.error.message).toBe("Too many login attempts. Please try again later.");
    expect(blocked.headers["retry-after"]).toBe("60");
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
  });

  test("applies only to login route and does not throttle unrelated routes", async () => {
    const app = buildAuthApp();

    for (let i = 0; i < 3; i += 1) {
      await request(app.callback())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", "203.0.113.30")
        .send({ username: "valid-user", password: "wrong-password" });
    }

    const registerResponse = await request(app.callback())
      .post("/api/v1/auth/register")
      .set("x-forwarded-for", "203.0.113.30")
      .send({ username: "x" });

    expect(registerResponse.status).toBe(400);
    expect(registerResponse.body.error.code).toBe("VALIDATION_ERROR");
  });
});
