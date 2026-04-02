const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const request = require("supertest");
const requestId = require("../src/middleware/request-id");
const errorHandler = require("../src/middleware/error-handler");
const requestRefundMock = vi.fn();
const refundServicePath = require.resolve("../src/modules/payments/refunds.service");

require.cache[refundServicePath] = {
  id: refundServicePath,
  filename: refundServicePath,
  loaded: true,
  exports: { requestRefund: requestRefundMock }
};

const paymentsRoutes = require("../src/modules/payments/payments.routes");

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
        username: ctx.get("x-test-username") || "test-user",
        email: "test@example.local",
        status: "active",
        sessionId: 1,
        roles: (ctx.get("x-test-user-roles") || "")
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean)
      };
    }
    await next();
  });

  app.use(paymentsRoutes.routes());
  app.use(paymentsRoutes.allowedMethods());
  return app;
}

describe("Refund authorization", () => {
  beforeEach(() => {
    requestRefundMock.mockReset();
    requestRefundMock.mockResolvedValue({ id: 77, refund_status: "processed", amount_cents: 100 });
  });

  afterAll(() => {
    delete require.cache[refundServicePath];
    delete require.cache[require.resolve("../src/modules/payments/payments.routes")];
  });

  test("unauthenticated refund request returns 401", async () => {
    const app = buildApp();
    const response = await request(app.callback())
      .post("/api/v1/payments/orders/101/refunds")
      .send({ amountDollars: 1.0, reason: "test", idempotencyKey: "key001" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(requestRefundMock).not.toHaveBeenCalled();
  });

  test("authenticated non-privileged user refund request returns 403", async () => {
    const app = buildApp();
    const response = await request(app.callback())
      .post("/api/v1/payments/orders/101/refunds")
      .set("x-test-user-id", "20")
      .set("x-test-user-roles", "user")
      .send({ amountDollars: 1.0, reason: "test", idempotencyKey: "key002" });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(requestRefundMock).not.toHaveBeenCalled();
  });

  test("cross-user style attempt by non-privileged actor returns 403", async () => {
    const app = buildApp();
    const response = await request(app.callback())
      .post("/api/v1/payments/orders/999/refunds")
      .set("x-test-user-id", "21")
      .set("x-test-user-roles", "user")
      .send({ amountDollars: 0.5, reason: "cross-user", idempotencyKey: "key003" });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(requestRefundMock).not.toHaveBeenCalled();
  });

  test("authorized support/admin role refund request succeeds", async () => {
    const app = buildApp();
    const response = await request(app.callback())
      .post("/api/v1/payments/orders/202/refunds")
      .set("x-test-user-id", "2")
      .set("x-test-user-roles", "support")
      .send({ amountDollars: 1.25, reason: "approved", idempotencyKey: "key004" });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(requestRefundMock).toHaveBeenCalledTimes(1);
    expect(requestRefundMock.mock.calls[0][0]).toMatchObject({
      orderId: 202,
      actorUserId: 2,
      actorRoles: ["support"]
    });
  });
});
