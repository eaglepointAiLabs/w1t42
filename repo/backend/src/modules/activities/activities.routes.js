const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { activityPayloadSchema, activityPatchSchema, activityIdParamSchema, gpxUploadSchema } = require("./activities.schemas");
const {
  createActivity,
  updateActivity,
  listActivities,
  getActivityById,
  archiveActivity,
  uploadGpx,
  listGpxCoordinates
} = require("./activities.service");

const router = new Router({ prefix: "/api/v1/activities" });

router.get("/", requireAuth, async (ctx) => {
  const rows = await listActivities(ctx.state.user.id);
  ctx.body = successResponse(rows);
});

router.post("/", requireAuth, validate({ body: activityPayloadSchema }), async (ctx) => {
  const activity = await createActivity({ userId: ctx.state.user.id, payload: ctx.request.body, requestId: ctx.state.requestId });
  ctx.status = 201;
  ctx.body = successResponse(activity);
});

router.get("/:activityId", requireAuth, validate({ params: activityIdParamSchema }), async (ctx) => {
  const activity = await getActivityById({ userId: ctx.state.user.id, activityId: ctx.params.activityId });
  ctx.body = successResponse(activity);
});

router.patch("/:activityId", requireAuth, validate({ params: activityIdParamSchema, body: activityPatchSchema }), async (ctx) => {
  const activity = await updateActivity({
    userId: ctx.state.user.id,
    activityId: ctx.params.activityId,
    payload: ctx.request.body,
    requestId: ctx.state.requestId
  });
  ctx.body = successResponse(activity);
});

router.delete("/:activityId", requireAuth, validate({ params: activityIdParamSchema }), async (ctx) => {
  const result = await archiveActivity({ userId: ctx.state.user.id, activityId: ctx.params.activityId, requestId: ctx.state.requestId });
  ctx.body = successResponse(result);
});

router.post("/:activityId/gpx", requireAuth, validate({ params: activityIdParamSchema, body: gpxUploadSchema }), async (ctx) => {
  const result = await uploadGpx({
    userId: ctx.state.user.id,
    activityId: ctx.params.activityId,
    payload: ctx.request.body,
    requestId: ctx.state.requestId
  });
  ctx.status = 201;
  ctx.body = successResponse(result);
});

router.get("/:activityId/coordinates", requireAuth, validate({ params: activityIdParamSchema }), async (ctx) => {
  const points = await listGpxCoordinates({ userId: ctx.state.user.id, activityId: ctx.params.activityId });
  ctx.body = successResponse(points);
});

module.exports = router;
