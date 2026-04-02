const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const rateLimit = require("../../middleware/rate-limit");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const env = require("../../config/env");
const { sourceSchema, sourcePatchSchema, sourceIdParamSchema, logsQuerySchema } = require("./ingestion.schemas");
const {
  listContentSources,
  createContentSource,
  updateContentSource,
  listIngestionLogs,
  enqueueIngestionScanJob
} = require("./ingestion.service");

const router = new Router({ prefix: "/api/v1/admin/ingestion" });

router.use(requireAuth, requireRole(["admin"]));
router.use(rateLimit({ limit: env.INGESTION_RATE_LIMIT_PER_MINUTE, windowMs: 60 * 1000 }));

router.get("/sources", async (ctx) => {
  const rows = await listContentSources();
  ctx.body = successResponse(rows);
});

router.post("/sources", validate({ body: sourceSchema }), async (ctx) => {
  const row = await createContentSource(ctx.request.body, ctx.state.user.id, ctx.state.requestId);
  ctx.status = 201;
  ctx.body = successResponse(row);
});

router.patch("/sources/:id", validate({ params: sourceIdParamSchema, body: sourcePatchSchema }), async (ctx) => {
  const row = await updateContentSource(ctx.params.id, ctx.request.body, ctx.state.user.id, ctx.state.requestId);
  ctx.body = successResponse(row);
});

router.post("/scan", async (ctx) => {
  await enqueueIngestionScanJob(ctx.state.user.id, ctx.state.requestId);
  ctx.body = successResponse({ queued: true });
});

router.get("/logs", validate({ query: logsQuerySchema }), async (ctx) => {
  const rows = await listIngestionLogs({
    sourceId: ctx.request.query.sourceId,
    limit: ctx.request.query.limit
  });
  ctx.body = successResponse(rows);
});

module.exports = router;
