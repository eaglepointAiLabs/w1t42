const Router = require("@koa/router");
const { requireAuth } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");

const router = new Router({ prefix: "/api/v1/users" });

router.get("/me", requireAuth, async (ctx) => {
  ctx.body = successResponse({
    id: ctx.state.user.id,
    username: ctx.state.user.username,
    email: ctx.state.user.email,
    status: ctx.state.user.status,
    roles: ctx.state.user.roles
  });
});

module.exports = router;
