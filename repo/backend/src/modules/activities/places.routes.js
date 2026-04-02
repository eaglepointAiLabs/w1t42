const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { placePayloadSchema, placeIdParamSchema } = require("./places.schemas");
const { listPlaces, createPlace, updatePlace, deletePlace } = require("./places.service");

const router = new Router({ prefix: "/api/v1/places" });

router.get("/", requireAuth, async (ctx) => {
  const rows = await listPlaces(ctx.state.user.id);
  ctx.body = successResponse(rows);
});

router.post("/", requireAuth, validate({ body: placePayloadSchema }), async (ctx) => {
  const place = await createPlace({ userId: ctx.state.user.id, payload: ctx.request.body, requestId: ctx.state.requestId });
  ctx.status = 201;
  ctx.body = successResponse(place);
});

router.patch("/:placeId", requireAuth, validate({ params: placeIdParamSchema, body: placePayloadSchema.partial() }), async (ctx) => {
  const place = await updatePlace({
    userId: ctx.state.user.id,
    placeId: ctx.params.placeId,
    payload: ctx.request.body,
    requestId: ctx.state.requestId
  });
  ctx.body = successResponse(place);
});

router.delete("/:placeId", requireAuth, validate({ params: placeIdParamSchema }), async (ctx) => {
  const result = await deletePlace({ userId: ctx.state.user.id, placeId: ctx.params.placeId, requestId: ctx.state.requestId });
  ctx.body = successResponse(result);
});

module.exports = router;
