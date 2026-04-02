const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { z } = require("zod");
const { createReplySchema, updateAppealStatusSchema, appealIdParamSchema } = require("./reviews.schemas");
const { addReply, updateAppealStatus, listAppealsForStaff } = require("./reviews.service");

const router = new Router({ prefix: "/api/v1/staff/reviews" });

router.use(requireAuth, requireRole(["coach", "support", "admin"]));

const appealsQuerySchema = z.object({
  status: z.enum(["submitted", "under_review", "upheld", "rejected", "resolved"]).optional()
});

router.get("/appeals", validate({ query: appealsQuerySchema }), async (ctx) => {
  const rows = await listAppealsForStaff(ctx.request.query.status || null);
  ctx.body = successResponse(rows);
});

router.post("/replies", validate({ body: createReplySchema }), async (ctx) => {
  const reply = await addReply({
    actorUser: ctx.state.user,
    reviewId: ctx.request.body.reviewId,
    parentReplyId: ctx.request.body.parentReplyId || null,
    replyText: ctx.request.body.replyText,
    requestId: ctx.state.requestId
  });
  ctx.status = 201;
  ctx.body = successResponse(reply);
});

router.patch("/appeals/:appealId", validate({ params: appealIdParamSchema, body: updateAppealStatusSchema }), async (ctx) => {
  const appeal = await updateAppealStatus({
    actorUserId: ctx.state.user.id,
    appealId: ctx.params.appealId,
    appealStatus: ctx.request.body.appealStatus,
    note: ctx.request.body.note,
    requestId: ctx.state.requestId
  });
  ctx.body = successResponse(appeal);
});

module.exports = router;
