const Router = require("@koa/router");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { processQueueTick, scheduleUnpaidOrderSweep } = require("../payments/processor.service");

const router = new Router({ prefix: "/api/v1/admin" });

router.get("/test", requireAuth, requireRole(["admin"]), async (ctx) => {
  ctx.body = successResponse({
    ok: true,
    message: "Admin route is accessible",
    actor: {
      id: ctx.state.user.id,
      username: ctx.state.user.username,
      roles: ctx.state.user.roles
    }
  });
});

router.post("/jobs/process-once", requireAuth, requireRole(["admin"]), async (ctx) => {
  await scheduleUnpaidOrderSweep();
  await processQueueTick(50);
  ctx.body = successResponse({ processed: true });
});

module.exports = router;
