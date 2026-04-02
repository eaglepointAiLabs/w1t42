const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { createPaymentImport, getImportById } = require("./payments.service");
const { requestRefund } = require("./refunds.service");
const { createImportSchema, importIdParamSchema, refundSchema } = require("./payments.schemas");
const { orderIdParamSchema } = require("../orders/orders.schemas");

const router = new Router({ prefix: "/api/v1/payments" });

router.post(
  "/imports",
  requireAuth,
  requireRole(["admin", "support"]),
  validate({ body: createImportSchema }),
  async (ctx) => {
    const result = await createPaymentImport({
      actorUserId: ctx.state.user.id,
      fileName: ctx.request.body.fileName,
      content: ctx.request.body.content,
      requestId: ctx.state.requestId
    });

    ctx.status = result.duplicate ? 200 : 201;
    ctx.body = successResponse(result);
  }
);

router.get("/imports/:importId", requireAuth, requireRole(["admin", "support"]), validate({ params: importIdParamSchema }), async (ctx) => {
  const data = await getImportById(ctx.params.importId);
  ctx.body = successResponse(data);
});

router.post(
  "/orders/:id/refunds",
  requireAuth,
  requireRole(["admin", "support"]),
  validate({ params: orderIdParamSchema, body: refundSchema }),
  async (ctx) => {
    const refund = await requestRefund({
      orderId: ctx.params.id,
      actorUserId: ctx.state.user.id,
      actorRoles: ctx.state.user.roles,
      amountDollars: ctx.request.body.amountDollars,
      reason: ctx.request.body.reason,
      idempotencyKey: `refund:${ctx.params.id}:${ctx.request.body.idempotencyKey}`,
      requestId: ctx.state.requestId
    });

    ctx.status = 201;
    ctx.body = successResponse(refund);
  }
);

module.exports = router;
