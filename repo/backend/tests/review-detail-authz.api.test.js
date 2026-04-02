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

const poolModulePath = require.resolve("../src/db/pool");
const reviewsRoutesPath = require.resolve("../src/modules/reviews/reviews.routes");
const reviewsServicePath = require.resolve("../src/modules/reviews/reviews.service");
const reviewsCoreServicePath = require.resolve("../src/modules/reviews/reviews.core.service");
const reviewsReadServicePath = require.resolve("../src/modules/reviews/reviews.read.service");

function buildPoolMock(reviewOwnerUserId) {
  return {
    query: vi.fn(async (sql) => {
      if (sql.includes("FROM reviews r") && sql.includes("WHERE r.id = ?")) {
        return [[{ id: 5, order_id: 1, user_id: reviewOwnerUserId, rating: 5, review_state: "published", anonymous_display: 0, review_text: "hello", published_at: new Date().toISOString(), username: "owner", display_name: "Owner" }]];
      }
      if (sql.includes("FROM review_dimension_scores")) {
        return [[{ dimension_config_id: 1, score: 5, label: "Quality", key_name: "quality" }]];
      }
      if (sql.includes("FROM review_images")) {
        return [[{ id: 2, mime_type: "image/jpeg", file_size_bytes: 10, sort_order: 1 }]];
      }
      if (sql.includes("FROM review_followups")) {
        return [[{ id: 3, review_id: 5, followup_text: "f", created_at: new Date().toISOString() }]];
      }
      if (sql.includes("FROM review_replies")) {
        return [[{ id: 4, parent_reply_id: null, reply_text: "r", created_at: new Date().toISOString(), author_role: "user", username: "owner" }]];
      }
      if (sql.includes("FROM appeals")) {
        return [[]];
      }
      return [[]];
    })
  };
}

function buildApp(poolMock) {
  clearModule(reviewsRoutesPath);
  clearModule(reviewsServicePath);
  clearModule(reviewsCoreServicePath);
  clearModule(reviewsReadServicePath);
  setModuleMock(poolModulePath, { pool: poolMock });

  const reviewsRoutes = require("../src/modules/reviews/reviews.routes");

  const app = new Koa();
  app.use(errorHandler);
  app.use(requestId);
  app.use(bodyParser({ enableTypes: ["json"] }));
  app.use(async (ctx, next) => {
    const userId = ctx.get("x-test-user-id");
    if (userId) {
      ctx.state.user = {
        id: Number(userId),
        username: "user",
        email: "user@example.local",
        status: "active",
        roles: (ctx.get("x-test-user-roles") || "")
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean)
      };
    }
    await next();
  });
  app.use(reviewsRoutes.routes());
  app.use(reviewsRoutes.allowedMethods());
  return app;
}

describe("Review detail authorization", () => {
  afterAll(() => {
    clearModule(poolModulePath);
    clearModule(reviewsRoutesPath);
    clearModule(reviewsServicePath);
    clearModule(reviewsCoreServicePath);
    clearModule(reviewsReadServicePath);
  });

  test("owner can access own review detail", async () => {
    const poolMock = buildPoolMock(10);
    const app = buildApp(poolMock);

    const response = await request(app.callback()).get("/api/v1/reviews/5").set("x-test-user-id", "10").set("x-test-user-roles", "user");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(5);
  });

  test("privileged role can access review detail", async () => {
    const poolMock = buildPoolMock(10);
    const app = buildApp(poolMock);

    const response = await request(app.callback()).get("/api/v1/reviews/5").set("x-test-user-id", "99").set("x-test-user-roles", "coach");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(5);
  });

  test("non-owner regular user is forbidden", async () => {
    const poolMock = buildPoolMock(10);
    const app = buildApp(poolMock);

    const response = await request(app.callback()).get("/api/v1/reviews/5").set("x-test-user-id", "88").set("x-test-user-roles", "user");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(poolMock.query).toHaveBeenCalledTimes(1);
  });

  test("non-authenticated user is unauthorized", async () => {
    const poolMock = buildPoolMock(10);
    const app = buildApp(poolMock);

    const response = await request(app.callback()).get("/api/v1/reviews/5");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
