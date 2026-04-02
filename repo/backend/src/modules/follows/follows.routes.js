const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { followUserIdParamSchema } = require("./follows.schemas");
const { followUser, unfollowUser, listMyFollows } = require("./follows.service");

const router = new Router({ prefix: "/api/v1/follows" });

router.use(requireAuth);

router.get("/mine", async (ctx) => {
  const rows = await listMyFollows(ctx.state.user.id);
  ctx.body = successResponse(rows);
});

router.post("/:userId", validate({ params: followUserIdParamSchema }), async (ctx) => {
  const result = await followUser({
    followerUserId: ctx.state.user.id,
    followedUserId: ctx.params.userId,
    requestId: ctx.state.requestId
  });
  ctx.status = result.duplicate ? 200 : 201;
  ctx.body = successResponse(result);
});

router.delete("/:userId", validate({ params: followUserIdParamSchema }), async (ctx) => {
  const result = await unfollowUser({
    followerUserId: ctx.state.user.id,
    followedUserId: ctx.params.userId,
    requestId: ctx.state.requestId
  });
  ctx.body = successResponse(result);
});

module.exports = router;
