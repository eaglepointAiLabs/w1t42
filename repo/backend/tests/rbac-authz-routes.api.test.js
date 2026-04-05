/**
 * RBAC authorization tests: verify that privileged/internal routes enforce
 * authentication (401) and role requirements (403), and succeed for allowed roles.
 *
 * Uses mocked services so no DB is required.
 */

const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const request = require("supertest");
const requestId = require("../src/middleware/request-id");
const errorHandler = require("../src/middleware/error-handler");

// ─── helpers ─────────────────────────────────────────────────────────────────

function setModuleMock(modulePath, exportsValue) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

/** Build a minimal Koa app with injected user state via test headers. */
function buildApp(...routerModules) {
  const app = new Koa();
  app.use(errorHandler);
  app.use(requestId);
  app.use(bodyParser({ enableTypes: ["json"] }));
  app.use(async (ctx, next) => {
    const userId = ctx.get("x-test-user-id");
    if (userId) {
      ctx.state.user = {
        id: Number(userId),
        username: ctx.get("x-test-username") || "test-user",
        email: "test@example.local",
        status: "active",
        sessionId: 1,
        roles: (ctx.get("x-test-user-roles") || "")
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      };
    }
    await next();
  });
  for (const router of routerModules) {
    app.use(router.routes());
    app.use(router.allowedMethods());
  }
  return app;
}

// ─── Admin routes ─────────────────────────────────────────────────────────────

describe("Admin route authorization", () => {
  const adminRoutesPath = require.resolve("../src/modules/admin/admin.routes");
  const processorServicePath = require.resolve("../src/modules/payments/processor.service");

  let adminRoutes;

  beforeAll(() => {
    setModuleMock(processorServicePath, {
      processQueueTick: vi.fn(async () => []),
      scheduleUnpaidOrderSweep: vi.fn(async () => {})
    });
    clearModule(adminRoutesPath);
    adminRoutes = require(adminRoutesPath);
  });

  afterAll(() => {
    clearModule(adminRoutesPath);
    clearModule(processorServicePath);
  });

  test("GET /api/v1/admin/test - unauthenticated returns 401", async () => {
    const app = buildApp(adminRoutes);
    const res = await request(app.callback()).get("/api/v1/admin/test");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("GET /api/v1/admin/test - wrong role (user) returns 403", async () => {
    const app = buildApp(adminRoutes);
    const res = await request(app.callback())
      .get("/api/v1/admin/test")
      .set("x-test-user-id", "5")
      .set("x-test-user-roles", "user");
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("GET /api/v1/admin/test - wrong role (coach) returns 403", async () => {
    const app = buildApp(adminRoutes);
    const res = await request(app.callback())
      .get("/api/v1/admin/test")
      .set("x-test-user-id", "6")
      .set("x-test-user-roles", "coach");
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("GET /api/v1/admin/test - admin role succeeds", async () => {
    const app = buildApp(adminRoutes);
    const res = await request(app.callback())
      .get("/api/v1/admin/test")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "admin");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("POST /api/v1/admin/jobs/process-once - unauthenticated returns 401", async () => {
    const app = buildApp(adminRoutes);
    const res = await request(app.callback()).post("/api/v1/admin/jobs/process-once");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("POST /api/v1/admin/jobs/process-once - support role returns 403", async () => {
    const app = buildApp(adminRoutes);
    const res = await request(app.callback())
      .post("/api/v1/admin/jobs/process-once")
      .set("x-test-user-id", "7")
      .set("x-test-user-roles", "support");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("POST /api/v1/admin/jobs/process-once - admin role succeeds", async () => {
    const app = buildApp(adminRoutes);
    const res = await request(app.callback())
      .post("/api/v1/admin/jobs/process-once")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "admin");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Payment import routes ─────────────────────────────────────────────────────

describe("Payment import route authorization", () => {
  const paymentsRoutesPath = require.resolve("../src/modules/payments/payments.routes");
  const refundsServicePath = require.resolve("../src/modules/payments/refunds.service");
  const paymentsServicePath = require.resolve("../src/modules/payments/payments.service");

  let paymentsRoutes;

  beforeAll(() => {
    setModuleMock(refundsServicePath, {
      requestRefund: vi.fn(async () => ({ id: 1, refund_status: "processed", amount_cents: 100 }))
    });
    setModuleMock(paymentsServicePath, {
      createPaymentImport: vi.fn(async () => ({ id: 1, duplicate: false })),
      getImportById: vi.fn(async () => ({ id: 1 }))
    });
    clearModule(paymentsRoutesPath);
    paymentsRoutes = require(paymentsRoutesPath);
  });

  afterAll(() => {
    clearModule(paymentsRoutesPath);
    clearModule(refundsServicePath);
    clearModule(paymentsServicePath);
  });

  test("POST /api/v1/payments/imports - unauthenticated returns 401", async () => {
    const app = buildApp(paymentsRoutes);
    const res = await request(app.callback())
      .post("/api/v1/payments/imports")
      .send({ fileName: "test.csv", content: "a,b,c,d,e,f" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("POST /api/v1/payments/imports - user role returns 403", async () => {
    const app = buildApp(paymentsRoutes);
    const res = await request(app.callback())
      .post("/api/v1/payments/imports")
      .set("x-test-user-id", "5")
      .set("x-test-user-roles", "user")
      .send({ fileName: "test.csv", content: "a,b,c,d,e,f" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("POST /api/v1/payments/imports - support role succeeds", async () => {
    const app = buildApp(paymentsRoutes);
    const res = await request(app.callback())
      .post("/api/v1/payments/imports")
      .set("x-test-user-id", "3")
      .set("x-test-user-roles", "support")
      .send({ fileName: "test.csv", content: "a,b,c,d,e,f" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test("POST /api/v1/payments/imports - admin role succeeds", async () => {
    const app = buildApp(paymentsRoutes);
    const res = await request(app.callback())
      .post("/api/v1/payments/imports")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "admin")
      .send({ fileName: "test.csv", content: "a,b,c,d,e,f" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test("GET /api/v1/payments/imports/:id - unauthenticated returns 401", async () => {
    const app = buildApp(paymentsRoutes);
    const res = await request(app.callback()).get("/api/v1/payments/imports/1");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("GET /api/v1/payments/imports/:id - coach role returns 403", async () => {
    const app = buildApp(paymentsRoutes);
    const res = await request(app.callback())
      .get("/api/v1/payments/imports/1")
      .set("x-test-user-id", "6")
      .set("x-test-user-roles", "coach");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("GET /api/v1/payments/imports/:id - admin role succeeds", async () => {
    const app = buildApp(paymentsRoutes);
    const res = await request(app.callback())
      .get("/api/v1/payments/imports/1")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "admin");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Ingestion routes ──────────────────────────────────────────────────────────

describe("Ingestion route authorization", () => {
  const ingestionRoutesPath = require.resolve("../src/modules/ingestion/ingestion.routes");
  const ingestionServicePath = require.resolve("../src/modules/ingestion/ingestion.service");
  const rateLimitPath = require.resolve("../src/middleware/rate-limit");
  const poolModulePath = require.resolve("../src/db/pool");

  let ingestionRoutes;

  beforeAll(() => {
    // Stub the DB-backed rate limiter so ingestion route tests are not blocked
    setModuleMock(rateLimitPath, () => async (ctx, next) => next());

    setModuleMock(ingestionServicePath, {
      listContentSources: vi.fn(async () => []),
      createContentSource: vi.fn(async () => ({ id: 1 })),
      updateContentSource: vi.fn(async () => ({ id: 1 })),
      listIngestionLogs: vi.fn(async () => []),
      enqueueIngestionScanJob: vi.fn(async () => {})
    });

    // Pool mock needed for any residual pool usage in the route module chain
    setModuleMock(poolModulePath, { pool: { query: vi.fn(async () => [[]]) } });

    clearModule(ingestionRoutesPath);
    ingestionRoutes = require(ingestionRoutesPath);
  });

  afterAll(() => {
    clearModule(ingestionRoutesPath);
    clearModule(ingestionServicePath);
    clearModule(rateLimitPath);
    clearModule(poolModulePath);
  });

  test("GET /api/v1/admin/ingestion/sources - unauthenticated returns 401", async () => {
    const app = buildApp(ingestionRoutes);
    const res = await request(app.callback()).get("/api/v1/admin/ingestion/sources");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("GET /api/v1/admin/ingestion/sources - user role returns 403", async () => {
    const app = buildApp(ingestionRoutes);
    const res = await request(app.callback())
      .get("/api/v1/admin/ingestion/sources")
      .set("x-test-user-id", "5")
      .set("x-test-user-roles", "user");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("GET /api/v1/admin/ingestion/sources - support role returns 403", async () => {
    const app = buildApp(ingestionRoutes);
    const res = await request(app.callback())
      .get("/api/v1/admin/ingestion/sources")
      .set("x-test-user-id", "3")
      .set("x-test-user-roles", "support");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("GET /api/v1/admin/ingestion/sources - admin role succeeds", async () => {
    const app = buildApp(ingestionRoutes);
    const res = await request(app.callback())
      .get("/api/v1/admin/ingestion/sources")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "admin");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("POST /api/v1/admin/ingestion/scan - unauthenticated returns 401", async () => {
    const app = buildApp(ingestionRoutes);
    const res = await request(app.callback()).post("/api/v1/admin/ingestion/scan");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("POST /api/v1/admin/ingestion/scan - coach role returns 403", async () => {
    const app = buildApp(ingestionRoutes);
    const res = await request(app.callback())
      .post("/api/v1/admin/ingestion/scan")
      .set("x-test-user-id", "6")
      .set("x-test-user-roles", "coach");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("POST /api/v1/admin/ingestion/scan - admin role succeeds", async () => {
    const app = buildApp(ingestionRoutes);
    const res = await request(app.callback())
      .post("/api/v1/admin/ingestion/scan")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "admin");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
