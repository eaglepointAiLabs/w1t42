const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { createOrderSchema, orderIdParamSchema } = require("./orders.schemas");
const { createOrder, listOrdersForUser, getOrderForUser, markOrderCompleted } = require("./orders.service");

const router = new Router({ prefix: "/api/v1/orders" });

router.post("/", requireAuth, validate({ body: createOrderSchema }), async (ctx) => {
  const order = await createOrder({
    userId: ctx.state.user.id,
    courseServiceId: ctx.request.body.courseServiceId,
    orderType: ctx.request.body.orderType,
    totalAmountDollars: ctx.request.body.totalAmountDollars,
    idempotencyKey: ctx.request.body.idempotencyKey,
    requestId: ctx.state.requestId
  });

  ctx.status = 201;
  ctx.body = successResponse(order);
});

router.get("/", requireAuth, async (ctx) => {
  const orders = await listOrdersForUser({ userId: ctx.state.user.id, roles: ctx.state.user.roles });
  ctx.body = successResponse(orders);
});

router.get("/:id", requireAuth, validate({ params: orderIdParamSchema }), async (ctx) => {
  const order = await getOrderForUser({
    orderId: ctx.params.id,
    userId: ctx.state.user.id,
    roles: ctx.state.user.roles
  });
  ctx.body = successResponse(order);
});

router.get("/:id/payment-status", requireAuth, validate({ params: orderIdParamSchema }), async (ctx) => {
  const order = await getOrderForUser({
    orderId: ctx.params.id,
    userId: ctx.state.user.id,
    roles: ctx.state.user.roles
  });

  ctx.body = successResponse({
    orderId: order.id,
    orderStatus: order.order_status,
    paidAmountCents: order.paid_amount_cents,
    refundedAmountCents: order.refunded_amount_cents
  });
});

router.post("/:id/complete", requireAuth, requireRole(["coach", "support", "admin"]), validate({ params: orderIdParamSchema }), async (ctx) => {
  const order = await markOrderCompleted(ctx.params.id, ctx.state.user.id, ctx.state.user.roles, ctx.state.requestId);
  ctx.body = successResponse(order);
});

module.exports = router;
