const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { feedQuerySchema, actionSchema, preferencesSchema } = require("./feed.schemas");
const { getPersonalizedFeed, recordFeedAction, getFeedPreferences, updateFeedPreferences } = require("./feed.service");

const router = new Router({ prefix: "/api/v1/feed" });

router.get("/", requireAuth, validate({ query: feedQuerySchema }), async (ctx) => {
  const items = await getPersonalizedFeed({ userId: ctx.state.user.id, limit: ctx.request.query.limit });
  ctx.body = successResponse(items);
});

router.post("/actions", requireAuth, validate({ body: actionSchema }), async (ctx) => {
  const result = await recordFeedAction({
    userId: ctx.state.user.id,
    action: ctx.request.body.action,
    itemType: ctx.request.body.itemType,
    similarityKey: ctx.request.body.similarityKey,
    contentItemId: ctx.request.body.contentItemId || null,
    author: ctx.request.body.author || null,
    tag: ctx.request.body.tag || null,
    requestId: ctx.state.requestId
  });
  ctx.body = successResponse(result);
});

router.get("/preferences", requireAuth, async (ctx) => {
  const prefs = await getFeedPreferences(ctx.state.user.id);
  ctx.body = successResponse(prefs);
});

router.put("/preferences", requireAuth, validate({ body: preferencesSchema }), async (ctx) => {
  const prefs = await updateFeedPreferences({ userId: ctx.state.user.id, payload: ctx.request.body, requestId: ctx.state.requestId });
  ctx.body = successResponse(prefs);
});

module.exports = router;
