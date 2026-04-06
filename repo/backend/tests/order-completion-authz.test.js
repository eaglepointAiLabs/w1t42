/**
 * Object-level authorization tests for order completion.
 *
 * Route-level: only coach/support/admin roles can reach the endpoint.
 * Service-level: admin and support may complete any paid order; a coach
 *   may only complete orders where they are the assigned instructor.
 */

const { pool } = require("../src/db/pool");
const { markOrderCompleted } = require("../src/modules/orders/orders.service");

// ─── service-level unit tests ─────────────────────────────────────────────────

describe("markOrderCompleted - object-level authorization", () => {
  let connectionMock;

  beforeEach(() => {
    vi.restoreAllMocks();

    connectionMock = {
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(),
      query: vi.fn()
    };

    pool.getConnection = vi.fn(async () => connectionMock);
    pool.query = vi.fn(async () => [[]]);
  });

  function orderRow(overrides = {}) {
    return {
      id: 10,
      user_id: 99,
      order_status: "paid",
      assigned_instructor_user_id: null,
      ...overrides
    };
  }

  test("admin can complete any paid order regardless of assignment", async () => {
    // connection: SELECT FOR UPDATE, then UPDATE
    connectionMock.query
      .mockResolvedValueOnce([[orderRow({ assigned_instructor_user_id: 5 })]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    // pool: writeAuditEvent INSERT, then SELECT updated order
    pool.query
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[orderRow({ order_status: "completed" })]]);

    const result = await markOrderCompleted(10, 1, ["admin"], "req-1");
    expect(result.order_status).toBe("completed");
    expect(connectionMock.commit).toHaveBeenCalled();
    expect(connectionMock.rollback).not.toHaveBeenCalled();
  });

  test("support can complete any paid order regardless of assignment", async () => {
    connectionMock.query
      .mockResolvedValueOnce([[orderRow({ assigned_instructor_user_id: 5 })]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    pool.query
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[orderRow({ order_status: "completed" })]]);

    const result = await markOrderCompleted(10, 7, ["support"], "req-2");
    expect(result.order_status).toBe("completed");
    expect(connectionMock.commit).toHaveBeenCalled();
  });

  test("assigned coach can complete their own order", async () => {
    connectionMock.query
      .mockResolvedValueOnce([[orderRow({ assigned_instructor_user_id: 42 })]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    pool.query
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[orderRow({ order_status: "completed" })]]);

    const result = await markOrderCompleted(10, 42, ["coach"], "req-3");
    expect(result.order_status).toBe("completed");
    expect(connectionMock.commit).toHaveBeenCalled();
  });

  test("coach who is NOT the assigned instructor is rejected with 403", async () => {
    // assigned_instructor_user_id is 5, but actor is coach 99
    connectionMock.query.mockResolvedValueOnce([[orderRow({ assigned_instructor_user_id: 5 })]]);

    await expect(markOrderCompleted(10, 99, ["coach"], "req-4")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
    expect(connectionMock.rollback).toHaveBeenCalled();
    expect(connectionMock.commit).not.toHaveBeenCalled();
  });

  test("coach on order with no assigned instructor is rejected with 403", async () => {
    connectionMock.query.mockResolvedValueOnce([[orderRow({ assigned_instructor_user_id: null })]]);

    await expect(markOrderCompleted(10, 42, ["coach"], "req-5")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
    expect(connectionMock.rollback).toHaveBeenCalled();
  });

  test("returns 400 when order is not in paid status", async () => {
    connectionMock.query.mockResolvedValueOnce([[orderRow({ order_status: "pending_payment" })]]);

    await expect(markOrderCompleted(10, 1, ["admin"], "req-6")).rejects.toMatchObject({
      status: 400,
      code: "ORDER_NOT_PAID"
    });
    expect(connectionMock.rollback).toHaveBeenCalled();
  });

  test("returns 404 when order does not exist", async () => {
    connectionMock.query.mockResolvedValueOnce([[]]); // empty result

    await expect(markOrderCompleted(999, 1, ["admin"], "req-7")).rejects.toMatchObject({
      status: 404,
      code: "ORDER_NOT_FOUND"
    });
    expect(connectionMock.rollback).toHaveBeenCalled();
  });
});

// ─── route-level tests ─────────────────────────────────────────────────────────

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

describe("POST /api/v1/orders/:id/complete - route authorization", () => {
  const ordersRoutesPath = require.resolve("../src/modules/orders/orders.routes");
  const ordersServicePath = require.resolve("../src/modules/orders/orders.service");

  let completeMock;
  let ordersRoutes;

  beforeEach(() => {
    completeMock = vi.fn(async () => ({ id: 10, order_status: "completed" }));
    clearModule(ordersRoutesPath);
    setModuleMock(ordersServicePath, {
      createOrder: vi.fn(),
      listOrdersForUser: vi.fn(async () => []),
      getOrderForUser: vi.fn(async () => ({})),
      cancelUnpaidOrder: vi.fn(async () => ({})),
      markOrderCompleted: completeMock
    });
    ordersRoutes = require(ordersRoutesPath);
  });

  afterAll(() => {
    clearModule(ordersRoutesPath);
    clearModule(ordersServicePath);
  });

  function buildApp() {
    const app = new Koa();
    app.use(errorHandler);
    app.use(requestId);
    app.use(bodyParser({ enableTypes: ["json"] }));
    app.use(async (ctx, next) => {
      const userId = ctx.get("x-test-user-id");
      if (userId) {
        ctx.state.user = {
          id: Number(userId),
          username: "test",
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
    app.use(ordersRoutes.routes());
    app.use(ordersRoutes.allowedMethods());
    return app;
  }

  test("unauthenticated request returns 401", async () => {
    const res = await request(buildApp().callback()).post("/api/v1/orders/10/complete");
    expect(res.status).toBe(401);
    expect(completeMock).not.toHaveBeenCalled();
  });

  test("regular user role returns 403", async () => {
    const res = await request(buildApp().callback())
      .post("/api/v1/orders/10/complete")
      .set("x-test-user-id", "5")
      .set("x-test-user-roles", "user");
    expect(res.status).toBe(403);
    expect(completeMock).not.toHaveBeenCalled();
  });

  test("coach role reaches service and passes roles through", async () => {
    const res = await request(buildApp().callback())
      .post("/api/v1/orders/10/complete")
      .set("x-test-user-id", "42")
      .set("x-test-user-roles", "coach");
    expect(res.status).toBe(200);
    expect(completeMock).toHaveBeenCalledWith(10, 42, ["coach"], expect.any(String));
  });

  test("admin role reaches service and passes roles through", async () => {
    const res = await request(buildApp().callback())
      .post("/api/v1/orders/10/complete")
      .set("x-test-user-id", "1")
      .set("x-test-user-roles", "admin");
    expect(res.status).toBe(200);
    expect(completeMock).toHaveBeenCalledWith(10, 1, ["admin"], expect.any(String));
  });
});
