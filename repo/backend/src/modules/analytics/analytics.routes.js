const Router = require("@koa/router");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { successResponse } = require("../../utils/api-response");
const { z } = require("zod");
const { analyticsFiltersSchema, reportTypeSchema, exportPayloadSchema } = require("./analytics.schemas");
const { runReport, runDashboard, exportReportCsv, listExportAccessLogs } = require("./analytics.service");

const querySchema = analyticsFiltersSchema.extend(reportTypeSchema.shape);
const logsQuery = z.object({ limit: z.coerce.number().int().positive().max(1000).default(200) });

const router = new Router({ prefix: "/api/v1/admin/analytics" });

router.use(requireAuth, requireRole(["admin", "support"]));

router.get("/dashboard", validate({ query: analyticsFiltersSchema }), async (ctx) => {
  const data = await runDashboard(ctx.request.query || {});
  ctx.body = successResponse(data);
});

router.get("/report", validate({ query: querySchema }), async (ctx) => {
  const data = await runReport(ctx.request.query.report, ctx.request.query);
  ctx.body = successResponse(data);
});

router.post("/export", validate({ body: exportPayloadSchema }), async (ctx) => {
  const result = await exportReportCsv({
    requestedByUserId: ctx.state.user.id,
    report: ctx.request.body.report,
    filters: ctx.request.body.filters || {}
  });

  ctx.set("Content-Type", "text/csv");
  ctx.set("Content-Disposition", `attachment; filename=\"${result.fileName}\"`);
  ctx.body = result.csv;
});

router.get("/export-logs", validate({ query: logsQuery }), async (ctx) => {
  const rows = await listExportAccessLogs(ctx.request.query.limit);
  ctx.body = successResponse(rows);
});

module.exports = router;
