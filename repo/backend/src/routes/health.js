const Router = require("@koa/router");
const { successResponse } = require("../utils/api-response");

const router = new Router();

router.get("/health", async (ctx) => {
  ctx.body = successResponse({
    status: "ok",
    service: "trailforge-backend",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
