/**
 * Cross-user idempotency key tests.
 *
 * Verifies that an idempotency key is scoped to the authenticated user:
 *  - User A creates an order with key K → succeeds.
 *  - User B uses the same key K → rejected with 409.
 *  - User A reuses key K → returns existing order (idempotent replay).
 */

const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const request = require("supertest");
const requestId = require("../src/middleware/request-id");
const errorHandler = require("../src/middleware/error-handler");

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

const ordersServicePath = require.resolve("../src/modules/orders/orders.service");
const ordersRoutesPath = require.resolve("../src/modules/orders/orders.routes");

function buildApp(createOrderMock) {
  clearModule(ordersRoutesPath);
  setModuleMock(ordersServicePath, {
    createOrder: createOrderMock,
    listOrdersForUser: vi.fn(async () => []),
    getOrderForUser: vi.fn(async () => ({})),
    cancelUnpaidOrder: vi.fn(async () => ({})),
    markOrderCompleted: vi.fn(async () => ({}))
  });

  const ordersRoutes = require(ordersRoutesPath);
  const app = new Koa();
  app.use(errorHandler);
  app.use(requestId);
  app.use(bodyParser({ enableTypes: ["json"] }));
  app.use(async (ctx, next) => {
    const userId = ctx.get("x-test-user-id");
    if (userId) {
      ctx.state.user = {
        id: Number(userId),
        username: ctx.get("x-test-username") || "user",
        email: "user@example.local",
        status: "active",
        sessionId: 1,
        roles: (ctx.get("x-test-user-roles") || "user")
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      };
    }
    await next();
  });
  app.use(ordersRoutes.routes());
  app.use(ordersRoutes.allowedMethods());
  return app;
}

afterAll(() => {
  clearModule(ordersRoutesPath);
  clearModule(ordersServicePath);
});

const validOrderBody = {
  courseServiceId: 10,
  orderType: "service",
  totalAmountDollars: 5.0,
  idempotencyKey: "shared-key-abc"
};

describe("Order idempotency key is scoped per user", () => {
  test("user A creates order with key K, user B with same key K gets 409", async () => {
    const ApiError = require("../src/errors/api-error");

    // createOrder mock: succeeds for user 1, throws 409 for user 2 (same key, different owner)
    const createOrderMock = vi.fn(async ({ userId, idempotencyKey }) => {
      if (userId === 1) {
        return { id: 42, user_id: 1, order_type: "service", order_status: "pending_payment", idempotency_key: idempotencyKey };
      }
      // Simulate per-user conflict: key exists but belongs to user 1
      throw new ApiError(409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency key already used by another user");
    });

    const app = buildApp(createOrderMock);

    // User A (id=1) creates order successfully
    const resA = await request(app.callback())
      .post("/api/v1/orders")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "user")
      .send(validOrderBody);

    expect(resA.status).toBe(201);
    expect(resA.body.success).toBe(true);
    expect(resA.body.data.user_id).toBe(1);

    // User B (id=2) uses the same key → conflict
    const resB = await request(app.callback())
      .post("/api/v1/orders")
      .set("x-test-user-id", "2")
      .set("x-test-user-roles", "user")
      .send(validOrderBody);

    expect(resB.status).toBe(409);
    expect(resB.body.success).toBe(false);
    expect(resB.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  test("same user replaying the same idempotency key receives the original order", async () => {
    const existingOrder = { id: 55, user_id: 1, order_type: "service", order_status: "pending_payment", idempotency_key: "replay-key" };

    // createOrder always returns the existing order (idempotent replay for same user)
    const createOrderMock = vi.fn(async () => existingOrder);

    const app = buildApp(createOrderMock);

    const body = { ...validOrderBody, idempotencyKey: "replay-key" };

    const res1 = await request(app.callback())
      .post("/api/v1/orders")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "user")
      .send(body);

    const res2 = await request(app.callback())
      .post("/api/v1/orders")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "user")
      .send(body);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.data.id).toBe(55);
    expect(res2.body.data.id).toBe(55);
    // Service was called twice (route does not deduplicate; service handles idempotency)
    expect(createOrderMock).toHaveBeenCalledTimes(2);
  });

  test("unauthenticated order creation returns 401", async () => {
    const createOrderMock = vi.fn(async () => ({}));
    const app = buildApp(createOrderMock);

    const res = await request(app.callback())
      .post("/api/v1/orders")
      .send(validOrderBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(createOrderMock).not.toHaveBeenCalled();
  });
});

// ─── Unit-level test for the service itself ─────────────────────────────────

describe("createOrder service - per-user idempotency enforcement", () => {
  const { pool } = require("../src/db/pool");

  beforeEach(() => {
    vi.restoreAllMocks();
    pool.query = vi.fn();
    pool.getConnection = vi.fn();
  });

  test("rejects with 409 when idempotency key belongs to a different user", async () => {
    // Re-require the real service (not mocked)
    clearModule(ordersServicePath);
    delete require.cache[ordersServicePath]; // ensure cleared
    const { createOrder } = require("../src/modules/orders/orders.service");

    const connectionMock = {
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(),
      query: vi.fn(async (sql) => {
        if (sql.includes("SELECT * FROM orders WHERE idempotency_key")) {
          // Return existing order owned by userId=100, not 200
          return [[{ id: 1, user_id: 100, order_status: "pending_payment", idempotency_key: "key-x" }]];
        }
        return [[]];
      })
    };

    pool.getConnection.mockResolvedValue(connectionMock);

    await expect(
      createOrder({
        userId: 200, // different user
        courseServiceId: 1,
        orderType: "service",
        totalAmountDollars: 10,
        idempotencyKey: "key-x",
        requestId: "req-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "IDEMPOTENCY_KEY_CONFLICT"
    });

    expect(connectionMock.rollback).toHaveBeenCalled();
  });

  test("returns existing order when idempotency key belongs to same user", async () => {
    clearModule(ordersServicePath);
    const { createOrder } = require("../src/modules/orders/orders.service");

    const existingOrder = { id: 7, user_id: 50, order_status: "pending_payment", idempotency_key: "key-y" };

    const connectionMock = {
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(),
      query: vi.fn(async (sql) => {
        if (sql.includes("SELECT * FROM orders WHERE idempotency_key")) {
          return [[existingOrder]];
        }
        return [[]];
      })
    };

    pool.getConnection.mockResolvedValue(connectionMock);

    const result = await createOrder({
      userId: 50, // same user
      courseServiceId: 1,
      orderType: "service",
      totalAmountDollars: 10,
      idempotencyKey: "key-y",
      requestId: "req-2"
    });

    expect(result).toEqual(existingOrder);
    expect(connectionMock.commit).toHaveBeenCalled();
    expect(connectionMock.rollback).not.toHaveBeenCalled();
  });
});
