const fs = require("fs");
const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const {
  createReviewSchema,
  createFollowupSchema,
  createAppealSchema,
  uploadImageSchema,
  idParamSchema,
  imageIdParamSchema
} = require("./reviews.schemas");
const {
  createReview,
  addFollowup,
  listUserReviews,
  getReviewDetail,
  createAppeal,
  uploadReviewImage,
  getReviewImage
} = require("./reviews.service");

const router = new Router({ prefix: "/api/v1/reviews" });

router.get("/mine", requireAuth, async (ctx) => {
  const rows = await listUserReviews(ctx.state.user.id);
  ctx.body = successResponse(rows);
});

router.post("/", requireAuth, validate({ body: createReviewSchema }), async (ctx) => {
  const review = await createReview({ userId: ctx.state.user.id, payload: ctx.request.body, requestId: ctx.state.requestId });
  ctx.status = 201;
  ctx.body = successResponse(review);
});

router.post("/:id/follow-up", requireAuth, validate({ params: idParamSchema, body: createFollowupSchema }), async (ctx) => {
  const followup = await addFollowup({
    userId: ctx.state.user.id,
    reviewId: ctx.params.id,
    followupText: ctx.request.body.followupText,
    requestId: ctx.state.requestId
  });
  ctx.status = 201;
  ctx.body = successResponse(followup);
});

router.get("/:id", requireAuth, validate({ params: idParamSchema }), async (ctx) => {
  const detail = await getReviewDetail({ reviewId: ctx.params.id, requester: ctx.state.user });
  ctx.body = successResponse(detail);
});

router.post("/:id/images", requireAuth, validate({ params: idParamSchema, body: uploadImageSchema }), async (ctx) => {
  const image = await uploadReviewImage({
    userId: ctx.state.user.id,
    reviewId: ctx.params.id,
    imagePayload: ctx.request.body,
    requestId: ctx.state.requestId
  });
  ctx.status = 201;
  ctx.body = successResponse(image);
});

router.get("/images/:imageId", requireAuth, validate({ params: imageIdParamSchema }), async (ctx) => {
  const image = await getReviewImage({ imageId: ctx.params.imageId, requester: ctx.state.user });
  ctx.type = image.mime_type;
  ctx.body = fs.createReadStream(image.file_path);
});

router.post("/:id/appeals", requireAuth, validate({ params: idParamSchema, body: createAppealSchema }), async (ctx) => {
  const appeal = await createAppeal({
    userId: ctx.state.user.id,
    reviewId: ctx.params.id,
    reason: ctx.request.body.reason,
    requestId: ctx.state.requestId
  });
  ctx.status = 201;
  ctx.body = successResponse(appeal);
});

module.exports = router;
